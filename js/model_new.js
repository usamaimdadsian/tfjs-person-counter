var {
  KalmanFilter
} = kalmanFilter;

const video = document.getElementById('webcam')
const canvasOutput = document.getElementById('canvasOutput')
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
  frame_no = 0

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

  
  // Create new object ID
  createNewID(center,dims){
    let obj_id = Object.keys(this.predictions_data).length
    let kFilter = new KalmanFilter({observation: 4})

    this.predictions_data['p'+obj_id] = {
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
      dimensions: dims,
      frame_no: this.frame_no,

      // Kalman Related
      kf: kFilter,
      predicted: kFilter.predict(),
      previous_corrected: null,
      predictions: [],
      results: [],
      prediction_counter: 0,
      observations: [dims]
    }
  }
  
  checkKalmanId(pred_dims){
    let min_key = null
    let min_dis = null
    console.log(this.predictions_data)
    for (let [key,value] of Object.entries(this.predictions_data)){
      let [x1,y1,w1,h1] = value.dimensions
      let [x2,y2,w2,h2] = pred_dims
      let c1 = [x1 + w1 / 2, y1 + h1 / 2]
      let c2 = [x2 + w2 / 2, y2 + h2 / 2]
      let dis = this.calc_distance(c1,c2)
      if (!min_dis || dis < min_dis){
        min_dis = dis
        min_key = key
      }
    }
    let req_obj = this.predictions_data[min_key]
    // if (value.counted && value.prediction_counter < 5){
    if (req_obj.prediction_counter < 5){
      let observations = req_obj.observations;
      if (observations.length < 2){
        let obs = observations[0]
        let b = [10,10,10,10]
        let results = obs.map(function(item){
            return item + b.shift()
        })
        observations.push(results)
      }
      let prediction = null
      observations.forEach(observation => {
          let previousCorrected = req_obj.previous_corrected
          req_obj.predicted = req_obj.kf.predict({
              previousCorrected
          });

          let predicted = req_obj.predicted
          const correctedState = req_obj.kf.correct({
              predicted,
              observation
          });
          let guessed_dims = predicted.mean
          prediction = [Math.round(guessed_dims[0][0]),Math.round(guessed_dims[1][0]),Math.round(guessed_dims[2][0]),Math.round(guessed_dims[3][0])]
          req_obj.previous_corrected = correctedState
      });
      // value.observations.push(prediction)
      if (this.checkOverlapped(req_obj.dimensions,prediction)){
        min_key = req_obj.id
        console.log('during_kalman',min_key)
        this.drawRect(...prediction,'kalman '+(min_key+1),'red',true)
      }
      else{
        min_key = null
      }
      
    }


    return min_key
  }
  
  // Logic to save and update person id data
  fillPredictions(center,dimension_points){
    let [x,y,w,h] = dimension_points
    // Fine the length of current assigned person ID
    let obj_len = Object.keys(this.predictions_data).length
    let obj_id = obj_len
    console.log('Length ID',obj_id)
    if (obj_len == 0){
      console.log('1 Yes')
      // Creates new person ID on start
      this.createNewID(center,dimension_points)
    }
    else{
      let same_frame_exist = false;
      for (let [key, value] of Object.entries(this.predictions_data)) {
          if (value.frame_no == this.frame_no){
            same_frame_exist = true
            break
          }
      }

      if (same_frame_exist){
        console.log('2 Yes')
        let unique_frame_exist = false;
        for (let [key, value] of Object.entries(this.predictions_data)) {
            if (value.frame_no != this.frame_no){
              unique_frame_exist = true
              break
            }
        }
        if (!unique_frame_exist){
          console.log('3 No')
          this.createNewID(center,dimension_points)
        }
      }
      console.log('before kalman')
      let kf_id = this.checkKalmanId(dimension_points)
      if(kf_id != null){
        console.log('4 Yes')
        this.predictions_data['p'+kf_id].pre_center = center
        this.predictions_data['p'+kf_id].end_time = new Date()
        this.predictions_data['p'+kf_id].obs.push(center)
        this.predictions_data['p'+kf_id].pre_x = x
        this.predictions_data['p'+kf_id].pre_y = y
        this.predictions_data['p'+kf_id].dimensions = dimension_points
        this.predictions_data['p'+kf_id].observations.push(dimension_points)
        obj_id = kf_id
      }
      else{
        console.log('4 No')
        this.createNewID(center,dimension_points)
      }
      console.log('after kalman',obj_id)
    }

    // If counting is enabled then starting counting people
    // if (this.counting){
    //   this.doCounting(obj_id,dimension_points)
    // }
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
      if (prediction_this_time) {
        pmodel.first_prediction = true
        pmodel.frame_no += 1
        // console.log(prediction_data)
      }
  
      if (!stop_proc) {
        // Call this function again to keep predicting when the browser is ready.
        window.requestAnimationFrame(pmodel.predictVideo);
      }
    })
  }  
  
}