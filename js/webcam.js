// Class to handle video related functions
class Webcam {
   constructor(webcamElement) {
     this.webcamElement = webcamElement;
   }

  //  Play Video
   async setupVideo(video_url){
    this.webcamElement.src = video_url;
    this.webcamElement.play()
    return new Promise((resolve) => {
      this.webcamElement.addEventListener('loadeddata',() =>{
        console.log('wecam loaded')
        resolve()
      })
    })
   }

  //  Stop Video
   async stop() {
     if (this.stream){
       this.stream.getTracks().forEach(function(track) {
         if (track.readyState == 'live' && track.kind === 'video') {
             track.stop();
         }
       });
     }
     this.webcamElement.pause();
   }

 }
 