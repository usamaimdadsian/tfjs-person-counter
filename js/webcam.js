
class Webcam {
   constructor(webcamElement) {
     this.webcamElement = webcamElement;
   }


   adjustVideoSize(width, height) {
      // const aspectRatio = width / height;
      // if (width >= height) {
      //   this.webcamElement.width = aspectRatio * this.webcamElement.height;
      // } else if (width < height) {
      //   this.webcamElement.height = this.webcamElement.width / aspectRatio;
      // }
      this.webcamElement.height = 480
      this.webcamElement.width = 640
    }
 
   /**
    * Crops an image tensor so we get a square image with no white space.
    * @param {Tensor4D} img An input image Tensor to crop.
    */
   
 
   async setup() {
     if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
       this.stream = await navigator.mediaDevices.getUserMedia({
         video: true
       });
       window.stream = this.stream;
       this.webcamElement.srcObject = this.stream;

       return new Promise((resolve) => {
          this.webcamElement.addEventListener('loadeddata',() =>{
            console.log('wecam loaded')
            resolve()
          })
        })

     } else {
       throw new Error('No webcam found!');
     }
   }

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
 