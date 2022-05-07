var {
  KalmanFilter
} = kalmanFilter;

const video = document.getElementById('webcam')
const webcamElem = document.getElementById('webcam-wrapper');
const kFilter = new KalmanFilter({observation: 2});

class Model{
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
  
  // Create new object ID
  createNewID(center,obj_id){
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
      counted: false
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
        this.predictions_data['p'+obj_id] = this.createNewID(center,obj_id)
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
              this.predictions_data[min_key].obs = kFilter.filterAll(this.predictions_data[min_key].obs)
              this.predictions_data[min_key].pre_x = x
              this.predictions_data[min_key].pre_y = y
              obj_id = this.predictions_data[min_key].id
            }
            else{
              obj_id = obj_len
              console.log('ID',obj_id+1,'Threshold',threshold,(min_value > threshold),!this.predictions_data[min_key].changeable,this.checkChangeable(min_key))
              this.predictions_data['p'+obj_id] = this.createNewID(center,obj_id)
            }
        }else{
          // Create new Object
            this.predictions_data[min_key].pre_center = center
            this.predictions_data[min_key].end_time = new Date()
            this.predictions_data[min_key].obs.push(center)
            this.predictions_data[min_key].obs = kFilter.filterAll(this.predictions_data[min_key].obs)
            this.predictions_data[min_key].pre_x = x
            this.predictions_data[min_key].pre_y = y
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
        // console.log(prediction_data)
      }
  
      if (!stop_proc) {
        // Call this function again to keep predicting when the browser is ready.
        window.requestAnimationFrame(pmodel.predictVideo);
      }
    })
  }  
  
}