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

function drawRect(x, y, w, h, text = '', color = 'red') {
  const rect = document.createElement('div');
  rect.classList.add('rect');
  rect.style.cssText = `top: ${y}px; left: ${x}px; width: ${w}px; height: ${h}px; border-color: ${color};`;

  // center = [x+w/2,y+h/2]

  // if (observations.length > 4){
  //   observations.shift()
  // }
  // observations.push(center)

  // while (observationElements.length > 4){
  //   let tele = document.getElementById(observationElements[0])
  //   tele.remove()
  //   observationElements.shift()
  // }

  const label = document.createElement('div');
  label.classList.add('label');
  label.innerText = text;
  rect.appendChild(label);

  webcamElem.appendChild(rect);

  // let trackingPoints = kFilter.filterAll(observations)
  // trackingPoints.forEach((point) => {
  //   let idName = "tracking_"+counter
  //   let trackingRect = document.createElement('div');
  //   trackingRect.classList.add('tracking')
  //   trackingRect.id = idName
  //   // trackingRect.style.cssText = `top: ${point[1]}px; left: ${point[0]}px; width: ${point[2]}px; height: ${point[3]}px; border-color: blue;`;
  //   trackingRect.style.cssText = `top: ${point[1]}px; left: ${point[0]}px; width: ${10}px; height: ${10}px; border-color: blue;`;
  //   webcamElem.appendChild(trackingRect)
  //   counter += 1
  //   observationElements.push(idName)
  // })
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
  if (pre_x && pre_y){
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

function createNewID(center,obj_id){
  return {
    pre_center: center,
    obs: [center],
    id: obj_id,
    start_time: new Date(),
    end_time: new Date(),
    pre_x: null,
    pre_y: null
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
          dis = calc_distance(value.pre_center,center)
          if (!min_value || dis < min_value){
              min_key = key
              min_value = dis
          }
      }
      let threshold = findThreshold(predictions_data[min_key].pre_x,predictions_data[min_key].pre_y,dimension_points)
      if(min_value > threshold){
          obj_id = obj_len
          predictions_data['p'+obj_id] = createNewID(center,obj_id)
      }else{
          predictions_data[min_key].pre_center = center
          predictions_data[min_key].end_time = new Date()
          predictions_data[min_key].obs.push(center)
          predictions_data[min_key].pre_x = x
          predictions_data[min_key].pre_y = y
          obj_id = predictions_data[min_key].id
      }
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