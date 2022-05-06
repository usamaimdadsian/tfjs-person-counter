var model = undefined;
var observations = [];
var observationElements = [];
var counter = 0;
var stop_proc = false
const webcam = new Webcam(document.getElementById('webcam'))

// Changed Video Width, Changed Video Height
var ratio = null






function doneLoading() {
  const elem = document.getElementById('loading-message');
  elem.style.display = 'none';

  const successElem = document.getElementById('success-message');
  successElem.style.display = 'block';

  const webcamElem = document.getElementById('webcam-wrapper');
  webcamElem.style.display = 'flex';

  ratio = video.videoWidth/640
  video.width = video.videoWidth/ratio
  video.height = video.videoHeight/ratio
  webcamElem.style.cssText = `width:${video.width}px; height:${video.height}px;`
}

function modelLoaded(){
  document.getElementById('btn-container').style.display = "block"
  document.getElementById('loading-message').innerText = "Model Successfully Loaded"

  const webcam_btn = document.getElementById('webcam-btn')
  const video_btn = document.getElementById('video-btn')
  const stop_btn = document.getElementById('stop-btn')


  webcam_btn.addEventListener('click', async (e) => {
    stop_proc = false
    e.target.disabled = true;
    video_btn.disabled = false
     await webcam.setup();
     console.log('webcam loaded')
     doneLoading();
      predictVideo()
    })
    
    video_btn.addEventListener('click', async (e) => {
      stop_proc = false
      await webcam.stop()
      e.target.disabled = true
      webcam_btn.disabled = false
      
      let url = document.getElementById('video_url').value
      webcam.setupVideo(url).then(() => {
        console.log('webcam loaded')
        counting = true
        drawROI()
        doneLoading()
        predictVideo()
      })
  })
  
  // document.getElementById('webcam').addEventListener('loadeddata',() => {
  //   console.log('data loaded')
  //   // run()
  // })
  
  stop_btn.addEventListener('click', async () => {
    webcam_btn.disabled = false
    video_btn.disabled = false
    predictions_data = {}
    await webcam.stop()
    stop_proc = true
    counting = false

    document.getElementById('loading-message').innerText = "Model Successfully Loaded"
    document.getElementById('loading-message').style.display = 'block'
    document.getElementById('success-message').style.display = 'none';
  })
}

(async function main() {
  model = await cocoSsd.load()

  modelLoaded()
})();