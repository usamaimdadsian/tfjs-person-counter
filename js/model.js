var {KalmanFilter} = kalmanFilter;

const video = document.getElementById('webcam')
const webcamElem = document.getElementById('webcam-wrapper');
const prediction_data = {}
let first_prediction = false

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
    while(rects[0]) {
      rects[0].parentNode.removeChild(rects[0]);
    }
}

function predictVideo() {
    webcamElem.style.cssText = `width:${video.videoWidth}px; height:${video.videoHeight}px;`
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
            let left = predictions[n].bbox[0]
            let top = predictions[n].bbox[1]
            let width = predictions[n].bbox[2]
            let height = predictions[n].bbox[3]
            drawRect(left, top, width, height,`${className} Confidence: ${Math.round(classProb * 100)}%`)
            prediction_this_time = true

            center = [left+width/2,top+height/2]

            
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

      if(prediction_this_time){
        first_prediction = true
        // console.log(prediction_data)
      }
      
      if (!stop_proc){
          // Call this function again to keep predicting when the browser is ready.
          window.requestAnimationFrame(predictVideo);
      }
    });
}