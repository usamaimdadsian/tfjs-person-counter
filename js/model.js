var {
  KalmanFilter
} = kalmanFilter;

const video = document.getElementById('webcam')
// const canvasOutput = document.getElementById('canvasOutput')
const webcamElem = document.getElementById('webcam-wrapper');

class Model{
  tracking_called = false
  streaming = false
  predictions_data = {}
  first_prediction = false
  counting = false
  colors = [
    '#00FFFF', '#00FF00', '#C0C0C0', '#000000', '#800000', '#008080', '#0000FF', '#000080',
    '#FFFFFF', '#FF00FF', '#808000', '#FFFF00', '#808080', '#800080', '#008000', '#FF0000'
  ]
  roi_x = 0
  roi_y = 0
  roi_w = 0
  roi_h = 0
  top_to_down = 0
  down_to_up = 0

  constructor(roi_dimensions = [247,142,247,88]){
    [this.roi_x,this.roi_y,this.roi_w,this.roi_h] = roi_dimensions
  }

  // It draws the center rectangle which shows counting
  drawROI(){
    let roi = document.createElement('div');
    roi.classList.add('roi');
    roi.style.cssText = `top: ${this.roi_y}px; left: ${this.roi_x}px; width: ${this.roi_w}px; height: ${this.roi_h}px; border-color: lightgreen;`;

    roi.innerHTML = `
      <div id="top-label" class="count-label">
        Counter: 0
      </div>
      <div id="bottom-label" class="count-label">
        Counter: 0
      </div>
    `
    webcamElem.appendChild(roi);
  }

  // Draws the detection rectangle on person along with label
  drawRect(x, y, w, h, text = '', color = 'red') {
    const rect = document.createElement('div');
    rect.classList.add('rect');
    rect.style.cssText = `top: ${y}px; left: ${x}px; width: ${w}px; height: ${h}px; border-color: ${color};`;

    const label = document.createElement('div');
    label.classList.add('label');
    label.innerText = text;
    rect.appendChild(label);

    webcamElem.appendChild(rect);
  }

  // Checks if two rectangles have some area common are not
  checkOverlapped(rec1,rec2){
    let [x1,y1,w1,h1] = rec1
    let [x2,y2,w2,h2] = rec2
    let [l1,r1] = [[x1,y1],[x1+w1,y1+h1]]
    let [l2,r2] = [[x2,y2],[x2+w2,y2+h2]]

    let area = (Math.max(l1[0], l2[0]) - Math.min(r1[0], r2[0])) * (Math.max(l1[1], l2[1]) - Math.min(r1[1], r2[1]))
      
    if (area > 0){
        return true
    }
    return false
  }
  
  // Find the euclidean distance
  calc_distance(p1, p2) {
    if (p1 && p2) {
      let [x1, y1] = p1
      let [x2, y2] = p2
      return Math.sqrt((x1 - x2) ** 2 + (y2 - y1) ** 2)
    } else {
      return 0
    }
  }

  // Find dynamic threshold for euclidean distance condition
  findThreshold(pre_x,pre_y,dimension_points){
    let [x,y,w,h] = dimension_points
    let threshold = 0
    
    if (pre_x && pre_y && !((y < 10 && y+h <  video.videoHeight/2)|| (y+h > video.videoHeight - 10 && y > video.videoHeight/2))){
        if (Math.abs(x-pre_x) > Math.abs(y-pre_y)){
            threshold = Math.ceil(w/2)
        }else{
            threshold = Math.ceil(h/2)
        }
    }
    else{
        threshold = 50
    }
    return threshold;
  }

  findDelay(t){
    let ct = new Date()
    return ct-t
  }
  checkChangeable(min_key){
    let flag = false
    let pt = this.predictions_data[min_key].end_time
    if (this.findDelay(pt) > 2500){
      flag = true
      this.predictions_data[min_key].changeable = false
    }
    return flag
  }
  
  // count the people
  inc_counter(obj,type='top'){
    let counter = 0
    if(!obj.counted){
      counter += 1
    }
    if (counter == 1){
      obj.last_counted = new Date()
      obj.counted = true
      if (type == 'top'){
        this.top_to_down += counter
        document.getElementById('top-label').innerText = "Counter: "+this.top_to_down
      }
      else{
        this.down_to_up += counter
        document.getElementById('bottom-label').innerText = "Counter: "+this.down_to_up
      }
    }
  }

  // First check the condition whether the prediction and roi rectangle are overlappend then do counting
  doCounting(obj_id,predicted_rec){
    let p_data = this.predictions_data['p'+obj_id]
    let size = p_data.obs.length
    if (this.checkOverlapped(predicted_rec,[this.roi_x,this.roi_y,this.roi_w,this.roi_h])){
      let p_point = p_data.obs[size-2]
      let c_point = p_data.obs[size-1]
      if (p_point && c_point){
        if (c_point[1] > p_point[1]){
          this.inc_counter(p_data,'top')
        }
        else{
          this.inc_counter(p_data,'down')
        }
      }
    }
    // console.log('Up -> Down:',top_to_down,'Down -> Up:',down_to_up)
  }

  correctDimensionValues(dims){
    let arr = []
    for (let dim of dims){
      if (dim < 0){
        arr.push(0)
      }
      else{
        arr.push(dim)
      }
    }
    return arr
  }

  meanShiftTracking(){
    let cap = new cv.VideoCapture(video);

    // take first frame of the video
    let frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    cap.read(frame);

    // hardcode the initial location of window
    let [x,y,w,h] = this.predictions_data['p0'].dimensions
    let trackWindow = new cv.Rect(298,1,118,202);

    // set up the ROI for tracking
    let roi = frame.roi(trackWindow);
    let hsvRoi = new cv.Mat();
    cv.cvtColor(roi, hsvRoi, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsvRoi, hsvRoi, cv.COLOR_RGB2HSV);
    let mask = new cv.Mat();
    let lowScalar = new cv.Scalar(30, 30, 0);
    let highScalar = new cv.Scalar(180, 180, 180);
    let low = new cv.Mat(hsvRoi.rows, hsvRoi.cols, hsvRoi.type(), lowScalar);
    let high = new cv.Mat(hsvRoi.rows, hsvRoi.cols, hsvRoi.type(), highScalar);
    cv.inRange(hsvRoi, low, high, mask);
    let roiHist = new cv.Mat();
    let hsvRoiVec = new cv.MatVector();
    hsvRoiVec.push_back(hsvRoi);
    cv.calcHist(hsvRoiVec, [0], mask, roiHist, [180], [0, 180]);
    cv.normalize(roiHist, roiHist, 0, 255, cv.NORM_MINMAX);

    // delete useless mats.
    roi.delete(); hsvRoi.delete(); mask.delete(); low.delete(); high.delete(); hsvRoiVec.delete();

    // Setup the termination criteria, either 10 iteration or move by at least 1 pt
    let termCrit = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 10, 1);

    let hsv = new cv.Mat(video.height, video.width, cv.CV_8UC3);
    let dst = new cv.Mat();
    let hsvVec = new cv.MatVector();
    hsvVec.push_back(hsv);

    const FPS = 30;
    function processVideo() {
      // console.log('Stream',this.streaming,pmodel.streaming)
      if (!pmodel.streaming) {
        // clean and stop.
        frame.delete(); dst.delete(); hsvVec.delete(); roiHist.delete(); hsv.delete();
        return;
      }
      let begin = Date.now();
      
      // start processing.
      cap.read(frame);
      cv.cvtColor(frame, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);
      cv.calcBackProject(hsvVec, [0], roiHist, dst, [0, 180], 1);

        // Apply meanshift to get the new location
        // and it also returns number of iterations meanShift took to converge,
        // which is useless in this demo.
        [, trackWindow] = cv.meanShift(dst, trackWindow, termCrit);

        // Draw it on image
        let [x, y, w, h] = [trackWindow.x, trackWindow.y, trackWindow.width, trackWindow.height];
        // this.drawRect(x,y,w,h,'','red')
        cv.rectangle(frame, new cv.Point(x, y), new cv.Point(x+w, y+h), [255, 0, 0, 255], 2);
        cv.imshow('canvasOutput', frame);

        // schedule the next one.
        let delay = 1000/FPS - (Date.now() - begin);
        setTimeout(processVideo, delay);
    };

    // schedule the first one.
    setTimeout(processVideo, 0);
  }
  
  // Create new object ID
  createNewID(center,obj_id,dims){
    return {
      pre_center: center,
      obs: [center],
      id: obj_id,
      start_time: new Date(),
      end_time: new Date(),
      pre_x: null,
      pre_y: null,
      changeable: true,
      last_counted: null,
      counted: false,
      dimensions: dims
    }
  }
  
  
  // Logic to save and update person id data
  fillPredictions(center,dimension_points){
    let [x,y,w,h] = dimension_points
    // Fine the length of current assigned person ID
    let obj_len = Object.keys(this.predictions_data).length
    let obj_id = null
    if (obj_len == 0){
      // Creates new person ID on start
      obj_id = obj_len
        this.predictions_data['p'+obj_id] = this.createNewID(center,obj_id,dimension_points)
    }else{
        // Find the distance of person id who has the minimum euclidean distance with the prediction
        let min_key = null
        let min_value = null
        for (let [key, value] of Object.entries(this.predictions_data)) {
            if(value.changeable){
              let dis = this.calc_distance(value.pre_center,center)
              if (!min_value || dis < min_value){
                  min_key = key
                  min_value = dis
              }
            }
        }
        // Find the threshold with should be then compared with the the distance calculated in previous step 
        let threshold = this.findThreshold(this.predictions_data[min_key].pre_x,this.predictions_data[min_key].pre_y,dimension_points)
  
        // if distance is greater than threshold or Person ID is changeable or check with Time constraint that if it is changeable
        if(min_value > threshold || !this.predictions_data[min_key].changeable || this.checkChangeable(min_key)){
          // if(min_value > threshold){
            // if the difference between previously detection and current detection is less than 1.5s then append to min_key object otherwise create new
            if ((this.predictions_data[min_key].end_time - this.predictions_data[min_key].start_time) < 1500){
              this.predictions_data[min_key].pre_center = center
              this.predictions_data[min_key].end_time = new Date()
              this.predictions_data[min_key].obs.push(center)
              this.predictions_data[min_key].pre_x = x
              this.predictions_data[min_key].pre_y = y
              this.predictions_data[min_key].dimensions = dimension_points
              obj_id = this.predictions_data[min_key].id
            }
            else{
              obj_id = obj_len
              // console.log('ID',obj_id+1,'Threshold',threshold,(min_value > threshold),!this.predictions_data[min_key].changeable,this.checkChangeable(min_key))
              this.predictions_data['p'+obj_id] = this.createNewID(center,obj_id,dimension_points)
            }
        }else{
          // Create new Object
            this.predictions_data[min_key].pre_center = center
            this.predictions_data[min_key].end_time = new Date()
            this.predictions_data[min_key].obs.push(center)
            this.predictions_data[min_key].pre_x = x
            this.predictions_data[min_key].pre_y = y
            this.predictions_data[min_key].dimensions = dimension_points
            obj_id = this.predictions_data[min_key].id
        }
    }
    // If counting is enabled then starting counting people
    if (this.counting){
      this.doCounting(obj_id,dimension_points)
    }
    return obj_id
  }
  
  // Function to remove rectangles after the prediction
  clearRects() {
    const rects = document.getElementsByClassName('rect');
    while (rects[0]) {
      rects[0].parentNode.removeChild(rects[0]);
    }
  }
  
  getCorrectedDimension(point){
    return Math.round(point/ratio)
  }
  
  
  // This function run in a loop to do prediction every time.
  predictVideo() {
    // if (Object.keys(pmodel.predictions_data).length > 0 && !pmodel.tracking_called){
    //   pmodel.meanShiftTracking()
    // }
    // Now let's start classifying the stream.
    model.detect(video).then(function (predictions) {
      // Remove any highlighting we did previous frame.
      pmodel.clearRects()
      let prediction_this_time = false
      // Now lets loop through predictions and draw them to the live view if
      // they have a high confidence score.
      for (let n = 0; n < predictions.length; n++) {
        // If we are over 66% sure we are sure we classified it right, draw it!
        if (predictions[n].score > 0.66 && predictions[n].class == 'person') {
          let className = predictions[n].class
          let classProb = predictions[n].score
          let left = pmodel.getCorrectedDimension(predictions[n].bbox[0])
          let top = pmodel.getCorrectedDimension(predictions[n].bbox[1])
          let width = pmodel.getCorrectedDimension(predictions[n].bbox[2])
          let height = pmodel.getCorrectedDimension(predictions[n].bbox[3])
  
          let center = [left + width / 2, top + height / 2]
          let color_id = pmodel.fillPredictions(center,[left,top,width,height])
  
          pmodel.drawRect(left, top, width, height, `ID: ${color_id+1}, ${className}: ${Math.round(classProb * 100)}%`, pmodel.colors[color_id])
          prediction_this_time = true
        }
      }

      let thtml = '';
      for (let [k, v] of Object.entries(pmodel.predictions_data)) {
        thtml += ` 
                  <div class="counting-container">
                    <h4>Person: ${v.id+1}</h4>
                    <span><b>Entering Time:</b>${v.start_time.toLocaleTimeString()}</span>
                    <br>
                    <span><b>Leave Time:</b>${v.end_time.toLocaleTimeString()}</span>
                    <br>
                    <span><b>Elapsed Time:</b>${v.end_time-v.start_time} milliseconds</span>
                  </div>
                `
      }
      document.getElementById('counting').innerHTML = thtml
      if (prediction_this_time) {
        pmodel.first_prediction = true
        // console.log(prediction_data)
      }
  
      if (!stop_proc) {
        // Call this function again to keep predicting when the browser is ready.
        window.requestAnimationFrame(pmodel.predictVideo);
      }
    })
  }  
  
}