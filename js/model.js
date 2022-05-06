var {
  KalmanFilter
} = kalmanFilter;

const video = document.getElementById('webcam')
const webcamElem = document.getElementById('webcam-wrapper');
var predictions_data = {}
let first_prediction = false
var pre_center = null
const html = ''
const colors = [
  '#00FFFF', '#00FF00', '#C0C0C0', '#000000', '#800000', '#008080', '#0000FF', '#000080',
  '#FFFFFF', '#FF00FF', '#808000', '#FFFF00', '#808080', '#800080', '#008000', '#FF0000'
]
var counter = 0
var [roi_x,roi_y,roi_w,roi_h] = [247,142,247,88]
var counting = false
var [top_to_down,down_to_up] = [0,0]

function drawROI(){
  let roi = document.createElement('div');
  roi.classList.add('roi');
  roi.style.cssText = `top: ${roi_y}px; left: ${roi_x}px; width: ${roi_w}px; height: ${roi_h}px; border-color: lightgreen;`;

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

function drawRect(x, y, w, h, text = '', color = 'red') {
  const rect = document.createElement('div');
  rect.classList.add('rect');
  rect.style.cssText = `top: ${y}px; left: ${x}px; width: ${w}px; height: ${h}px; border-color: ${color};`;

  const label = document.createElement('div');
  label.classList.add('label');
  label.innerText = text;
  rect.appendChild(label);

  webcamElem.appendChild(rect);
}

function setPredictionStats(){
  let thtml = '';
  for (let [k, v] of Object.entries(predictions_data)) {
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
}

function checkOverlapped(rec1,rec2){
  let [x1,y1,w1,h1] = rec1
  let [x2,y2,w2,h2] = rec2
  let [l1,r1] = [[x1,y1],[x1+w1,y1+h1]]
  let [l2,r2] = [[x2,y2],[x2+w2,y2+h2]]

  area = (Math.max(l1[0], l2[0]) - Math.min(r1[0], r2[0])) * (Math.max(l1[1], l2[1]) - Math.min(r1[1], r2[1]))
    
  if (area > 0){
      return true
  }
  return false
}

function calc_distance(p1, p2) {
  if (p1 && p2) {
    let [x1, y1] = p1
    let [x2, y2] = p2
    return Math.sqrt((x1 - x2) ** 2 + (y2 - y1) ** 2)
  } else {
    return 0
  }
}

function findThreshold(pre_x,pre_y,dimension_points){
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

function findDelay(t){
  ct = new Date()
  return ct-t
}
function checkChangeable(min_key){
  flag = false
  pt = predictions_data[min_key].end_time
  if (findDelay(pt) > 2500){
    flag = true
    predictions_data[min_key].changeable = false
  }
  return flag
}

function inc_counter(obj,type='top'){
  let counter = 0
  // if (obj.last_counted == null){
  //   counter += 1
  // }else{
  //   delta_t = new Date() - obj.last_counted;
  //   if (delta_t > 4000){
  //     counter += 1
  //   }
  // }
  if(!obj.counted){
    counter += 1
  }
  if (counter == 1){
    obj.last_counted = new Date()
    obj.counted = true
    if (type == 'top'){
      top_to_down += counter
      document.getElementById('top-label').innerText = "Counter: "+top_to_down
    }
    else{
      down_to_up += counter
      document.getElementById('bottom-label').innerText = "Counter: "+down_to_up

    }
  }

}

function doCounting(obj_id,predicted_rec){
  let p_data = predictions_data['p'+obj_id]
  let size = p_data.obs.length
  if (checkOverlapped(predicted_rec,[roi_x,roi_y,roi_w,roi_h])){
    p_point = p_data.obs[size-2]
    c_point = p_data.obs[size-1]
    if (p_point && c_point){
      if (c_point[1] > p_point[1]){
        inc_counter(p_data,'top')
      }
      else{
        inc_counter(p_data,'down')
      }

    }
  }
  console.log('Up -> Down:',top_to_down,'Down -> Up:',down_to_up)
}

function createNewID(center,obj_id){
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

function fillPredictions(center,dimension_points){
  let [x,y,w,h] = dimension_points
  obj_len = Object.keys(predictions_data).length
  obj_id = null
  if (obj_len == 0){
    obj_id = obj_len
      predictions_data['p'+obj_id] = createNewID(center,obj_id)
  }else{
      min_key = null
      min_value = null
      for (let [key, value] of Object.entries(predictions_data)) {
          if(value.changeable){
            dis = calc_distance(value.pre_center,center)
            if (!min_value || dis < min_value){
                min_key = key
                min_value = dis
            }
          }
      }
      let threshold = findThreshold(predictions_data[min_key].pre_x,predictions_data[min_key].pre_y,dimension_points)
      if(min_value > threshold || !predictions_data[min_key].changeable || checkChangeable(min_key)){
        // if(min_value > threshold){
          if ((predictions_data[min_key].end_time - predictions_data[min_key].start_time) < 1500){
            predictions_data[min_key].pre_center = center
            predictions_data[min_key].end_time = new Date()
            predictions_data[min_key].obs.push(center)
            predictions_data[min_key].pre_x = x
            predictions_data[min_key].pre_y = y
            obj_id = predictions_data[min_key].id
          }
          else{
            obj_id = obj_len
            console.log('ID',obj_id+1,'Threshold',threshold,(min_value > threshold),!predictions_data[min_key].changeable,checkChangeable(min_key))
            predictions_data['p'+obj_id] = createNewID(center,obj_id)
          }
      }else{
          predictions_data[min_key].pre_center = center
          predictions_data[min_key].end_time = new Date()
          predictions_data[min_key].obs.push(center)
          predictions_data[min_key].pre_x = x
          predictions_data[min_key].pre_y = y
          obj_id = predictions_data[min_key].id
      }
  }

  if (counting){
    doCounting(obj_id,dimension_points)
  }
  return obj_id
}

// function getPredicted(kf,predicted,pCorrected,obs){
//   console.log(obs)
//   predicted = kf.predict({
//       pCorrected
//   });

//   const correctedState = kf.correct({
//       predicted,
//       obs
//   });
//   prediction = predicted.mean[0][0]
//   // predictions.push(predicted.mean[0][0])
//   // predicted = predictedState.mean

//   // results.push(...correctedState.mean[0]);

//   // update the pCorrected for next loop iteration
//   pCorrected = correctedState
//   return {predicted,pCorrected,prediction}
// }


function clearRects() {
  const rects = document.getElementsByClassName('rect');
  while (rects[0]) {
    rects[0].parentNode.removeChild(rects[0]);
  }
}

function getCorrectedDimension(point){
  return Math.round(point/ratio)
}

function predictVideo() {
  // Now let's start classifying the stream.
  model.detect(video).then(function (predictions) {
    // Remove any highlighting we did previous frame.
    clearRects()
    let prediction_this_time = false
    // Now lets loop through predictions and draw them to the live view if
    // they have a high confidence score.
    for (let n = 0; n < predictions.length; n++) {
      // If we are over 66% sure we are sure we classified it right, draw it!
      if (predictions[n].score > 0.66 && predictions[n].class == 'person') {
        let className = predictions[n].class
        let classProb = predictions[n].score
        let left = getCorrectedDimension(predictions[n].bbox[0])
        let top = getCorrectedDimension(predictions[n].bbox[1])
        let width = getCorrectedDimension(predictions[n].bbox[2])
        let height = getCorrectedDimension(predictions[n].bbox[3])

        let center = [left + width / 2, top + height / 2]
        let color_id = fillPredictions(center,[left,top,width,height])

        drawRect(left, top, width, height, `ID: ${color_id+1}, ${className}: ${Math.round(classProb * 100)}%`, colors[color_id])
        prediction_this_time = true


        // if (!first_prediction){
        //   var kFilter = new KalmanFilter({observation: 2});
        //   var predicted = kFilter.predict()
        //   var {predi,pCorrected,prediction} = getPredicted(kFilter,predicted,null,center)


        //   prediction_data['p'+n] = {
        //     kFilter: kFilter,
        //     observations: [center],
        //     predictions: [prediction],
        //     previouslyCorrected: pCorrected,
        //     predicted: predi

        //   }
        // }
      }
    }
    setPredictionStats()
    if (prediction_this_time) {
      first_prediction = true
      // console.log(prediction_data)
    }

    if (!stop_proc) {
      // Call this function again to keep predicting when the browser is ready.
      window.requestAnimationFrame(predictVideo);
    }
  });
}