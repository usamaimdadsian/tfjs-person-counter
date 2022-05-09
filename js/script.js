var model = undefined;
var observations = [];
var observationElements = [];
var counter = 0;
var stop_proc = false
const webcam = new Webcam(document.getElementById('webcam'))
const pmodel = new Model([0,197,640,88])

// Changed Video Width, Changed Video Height
var ratio = null





// show model messages function
function doneLoading() {
  const elem = document.getElementById('loading-message');
  elem.style.display = 'none';

  const successElem = document.getElementById('success-message');
  successElem.style.display = 'block';

  // Enable camera element
  const webcamElem = document.getElementById('webcam-wrapper');
  webcamElem.style.display = 'flex';

  // Resize video to fit on screen
  ratio = video.videoWidth/640
  video.width = video.videoWidth/ratio
  video.height = video.videoHeight/ratio
  webcamElem.style.cssText = `width:${video.width}px; height:${video.height}px;`

  canvasOutput.width = video.width
  canvasOutput.height = video.height

}


// Handle button events and trigger functions with them
function modelLoaded(){
  document.getElementById('btn-container').style.display = "block"
  document.getElementById('loading-message').innerText = "Model Successfully Loaded"

  const video_btn = document.getElementById('video-btn')
  const stop_btn = document.getElementById('stop-btn')


    // Functions to do on video button click
    video_btn.addEventListener('click', async (e) => {
      stop_proc = false
      await webcam.stop()
      e.target.disabled = true
      
      let url = document.getElementById('video_url').value
      webcam.setupVideo(url).then(() => {
        console.log('webcam loaded')
        pmodel.streaming = true
        pmodel.counting = true
        pmodel.drawROI()
        doneLoading()
        pmodel.predictVideo()
      })
  })
  
  // Functions to do on stop button click
  stop_btn.addEventListener('click', async () => {
    video_btn.disabled = false
    pmodel.predictions_data = {}
    await webcam.stop()
    stop_proc = true
    pmodel.counting = false
    pmodel.streaming = false

    document.getElementById('loading-message').innerText = "Model Successfully Loaded"
    document.getElementById('loading-message').style.display = 'block'
    document.getElementById('success-message').style.display = 'none';
  })
}


// Main function which is fist called
async function main() {
  // Loads the cocossd model from the internet
  model = await cocoSsd.load()

  modelLoaded()
};