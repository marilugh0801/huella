const canvas = document.getElementById('drawCanvas')
const video = document.getElementById('videoEl')
const ctx = canvas.getContext('2d')

canvas.width = window.innerWidth
canvas.height = window.innerHeight

const startBtn = document.getElementById('startBtn')

video.style.width = '320px'
video.style.height = '240px'

// Variables de dibujo
var lastX = null
var lastY = null
var posHistory = []
var historySize = 5

startBtn.addEventListener('click', function() {
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(function(stream) {
        video.srcObject = stream
        video.play()
        video.style.position = 'fixed'
        video.style.top = '0'
        video.style.left = '0'
        video.style.width = '320px'
        video.style.height = '240px'
        video.style.zIndex = '999'
        startBtn.style.display = 'none'
        console.log('Cámara conectada')
    })
})

const mpHands = new Hands({
    locateFile: function(file) {
    return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/' + file
    }
})

mpHands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6
})

mpHands.onResults(function(results) {

  // Si no hay mano cortamos el trazo
    if (results.multiHandLandmarks.length === 0) {
    lastX = null
    lastY = null
    posHistory = []
    return
    }

    var landmarks = results.multiHandLandmarks[0]
    var indexTip = landmarks[8]

  var rawX = (1 - indexTip.x) * canvas.width
  var rawY = indexTip.y * canvas.height

  // Agregamos la posición actual al historial
    posHistory.push({ x: rawX, y: rawY })

  // Si el historial supera el tamaño máximo eliminamos el más antiguo
    if (posHistory.length > historySize) {
    posHistory.shift()
    }

  // Promediamos todas las posiciones para suavizar el trazo
    var x = 0
    var y = 0
    for (var i = 0; i < posHistory.length; i++) {
    x = x + posHistory[i].x
    y = y + posHistory[i].y
    }
    x = x / posHistory.length
    y = y / posHistory.length

  // Dibujamos la línea suavizada
    if (lastX !== null && lastY !== null) {
        ctx.beginPath()
        ctx.moveTo(lastX, lastY)
        ctx.lineTo(x, y)
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.stroke()
    }

    lastX = x
    lastY = y
})

// Conectamos la cámara con MediaPipe
video.addEventListener('loadeddata', function() {
    async function detectFrame() {
    await mpHands.send({ image: video })
    requestAnimationFrame(detectFrame)
    }
    detectFrame()
})