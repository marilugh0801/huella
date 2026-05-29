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
var lastPinchTime = null
var isPinching = false

// Memoria de trazos
var strokes = []
var redoStrokes = [] // trazos deshechos para rehacer
var currentStroke = []

// Timers de gestos
var lastVTime = null
var openHandStartTime = null // cuando empezó el gesto de mano abierta

// Canvas encima del video para el esqueleto
var overlayCanvas = document.createElement('canvas')
overlayCanvas.width = 320
overlayCanvas.height = 240
overlayCanvas.style.position = 'fixed'
overlayCanvas.style.top = '0'
overlayCanvas.style.left = '0'
overlayCanvas.style.zIndex = '1000'
overlayCanvas.style.pointerEvents = 'none'
document.body.appendChild(overlayCanvas)
var octx = overlayCanvas.getContext('2d')

// Letrero de estado
var statusLabel = document.createElement('div')
statusLabel.style.position = 'fixed'
statusLabel.style.top = '245px'
statusLabel.style.left = '0'
statusLabel.style.width = '320px'
statusLabel.style.textAlign = 'center'
statusLabel.style.fontFamily = 'monospace'
statusLabel.style.fontSize = '14px'
statusLabel.style.color = 'white'
statusLabel.style.background = 'rgba(0,0,0,0.5)'
statusLabel.style.padding = '4px'
statusLabel.style.zIndex = '1000'
statusLabel.textContent = 'Esperando mano...'
document.body.appendChild(statusLabel)

// Aviso de confirmación para borrar todo
var confirmLabel = document.createElement('div')
confirmLabel.style.position = 'fixed'
confirmLabel.style.top = '50%'
confirmLabel.style.left = '50%'
confirmLabel.style.transform = 'translate(-50%, -50%)'
confirmLabel.style.fontFamily = 'monospace'
confirmLabel.style.fontSize = '24px'
confirmLabel.style.color = 'white'
confirmLabel.style.background = 'rgba(200,0,0,0.85)'
confirmLabel.style.padding = '20px 32px'
confirmLabel.style.borderRadius = '12px'
confirmLabel.style.zIndex = '2000'
confirmLabel.style.display = 'none'
confirmLabel.style.textAlign = 'center'
confirmLabel.textContent = '⚠️ Mantén la mano abierta\n2 segundos para borrar todo'
document.body.appendChild(confirmLabel)

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
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.4
})

var connections = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20]
]

function drawSkeleton(landmarks) {
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

  octx.strokeStyle = 'lime'
  octx.lineWidth = 2
  for (var i = 0; i < connections.length; i++) {
    var a = landmarks[connections[i][0]]
    var b = landmarks[connections[i][1]]
    var ax = a.x * overlayCanvas.width
    var ay = a.y * overlayCanvas.height
    var bx = b.x * overlayCanvas.width
    var by = b.y * overlayCanvas.height
    octx.beginPath()
    octx.moveTo(ax, ay)
    octx.lineTo(bx, by)
    octx.stroke()
  }

  for (var j = 0; j < landmarks.length; j++) {
    var px = landmarks[j].x * overlayCanvas.width
    var py = landmarks[j].y * overlayCanvas.height
    octx.beginPath()
    octx.arc(px, py, 3, 0, Math.PI * 2)
    octx.fillStyle = 'white'
    octx.fill()
  }
}

function isFingerExtended(tip, pip) {
  return tip.y < pip.y
}

function redrawAllStrokes() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (var s = 0; s < strokes.length; s++) {
    var stroke = strokes[s]
    if (stroke.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(stroke[0].x, stroke[0].y)
    for (var p = 1; p < stroke.length; p++) {
      ctx.lineTo(stroke[p].x, stroke[p].y)
    }
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
}

mpHands.onResults(function(results) {

  if (results.multiHandLandmarks.length === 0) {
    if (currentStroke.length > 1) {
      strokes.push(currentStroke)
      currentStroke = []
    }
    lastX = null
    lastY = null
    posHistory = []
    openHandStartTime = null
    confirmLabel.style.display = 'none'
    octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
    statusLabel.textContent = 'Esperando mano...'
    return
  }

  var landmarks = results.multiHandLandmarks[0]

  drawSkeleton(landmarks)

  var thumbTip  = landmarks[4]
  var indexTip  = landmarks[8]
  var middleTip = landmarks[12]
  var ringTip   = landmarks[16]
  var pinkyTip  = landmarks[20]

  var indexPip  = landmarks[6]
  var middlePip = landmarks[10]
  var ringPip   = landmarks[14]
  var pinkyPip  = landmarks[18]

  var indexUp  = isFingerExtended(indexTip, indexPip)
  var middleUp = isFingerExtended(middleTip, middlePip)
  var ringUp   = isFingerExtended(ringTip, ringPip)
  var pinkyUp  = isFingerExtended(pinkyTip, pinkyPip)

  // Gestos
  var isVGesture       = indexUp && middleUp && !ringUp && !pinkyUp
  var isThreeFingers   = indexUp && middleUp && ringUp && !pinkyUp
  var isOpenHand       = indexUp && middleUp && ringUp && pinkyUp

  var dx = thumbTip.x - indexTip.x
  var dy = thumbTip.y - indexTip.y
  var pinchDistance = Math.sqrt(dx * dx + dy * dy)
  isPinching = pinchDistance < 0.05

  var onlyIndexUp = indexUp && !middleUp && !ringUp && !pinkyUp

  var rawX = (1 - indexTip.x) * canvas.width
  var rawY = indexTip.y * canvas.height

  // Gesto mano abierta — borrar todo con confirmación de 2 segundos
  if (isOpenHand) {
    if (openHandStartTime === null) {
      openHandStartTime = Date.now()
    }
    var elapsed = Date.now() - openHandStartTime
    var remaining = Math.ceil((2000 - elapsed) / 1000)
    confirmLabel.style.display = 'block'
    confirmLabel.textContent = '⚠️ Mantén la mano abierta\n' + remaining + ' segundo(s) para borrar todo'

    if (elapsed >= 2000) {
      // Borramos todo
      strokes = []
      redoStrokes = []
      currentStroke = []
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      openHandStartTime = null
      confirmLabel.style.display = 'none'
      statusLabel.textContent = 'Tablero borrado'
    }

    lastX = null
    lastY = null
    posHistory = []
    return
  } else {
    // Si deja de abrir la mano cancelamos
    openHandStartTime = null
    confirmLabel.style.display = 'none'
  }

  // Gesto 3 dedos — rehacer
  if (isThreeFingers) {
    if (redoStrokes.length > 0) {
      var strokeToRedo = redoStrokes.pop()
      strokes.push(strokeToRedo)
      redrawAllStrokes()
      statusLabel.textContent = 'Rehaciendo trazo'
    } else {
      statusLabel.textContent = 'Nada que rehacer'
    }
    lastX = null
    lastY = null
    posHistory = []
    return
  }

  // Gesto V — borra el último trazo
  if (isVGesture) {
    if (lastVTime === null || Date.now() - lastVTime > 1000) {
      currentStroke = []
      if (strokes.length > 0) {
        var removedStroke = strokes.pop()
        redoStrokes.push(removedStroke) // lo guardamos para poder rehacer
        redrawAllStrokes()
      }
      lastVTime = Date.now()
    }
    lastX = null
    lastY = null
    posHistory = []
    statusLabel.textContent = 'Borrando último trazo'
    return
  }

  // Si está pellizcando pausamos
  if (isPinching) {
    if (currentStroke.length > 1) {
      strokes.push(currentStroke)
      currentStroke = []
    }
    lastX = null
    lastY = null
    posHistory = []
    lastPinchTime = Date.now()
    statusLabel.textContent = 'Pausado'
    return
  }

  // Esperamos 600ms después del pellizco
  if (lastPinchTime !== null && Date.now() - lastPinchTime < 600) {
    lastX = null
    lastY = null
    posHistory = []
    statusLabel.textContent = 'Pausado'
    return
  }

  // Si el índice no está solo extendido no dibuja
  if (!onlyIndexUp) {
    if (currentStroke.length > 1) {
      strokes.push(currentStroke)
      currentStroke = []
    }
    lastX = null
    lastY = null
    posHistory = []
    statusLabel.textContent = 'Levanta solo el índice para dibujar'
    return
  }

  statusLabel.textContent = 'Dibujando'

  // Al dibujar limpiamos redoStrokes porque ya no tiene sentido rehacer
  redoStrokes = []

  posHistory.push({ x: rawX, y: rawY })

  if (posHistory.length > historySize) {
    posHistory.shift()
  }

  var x = 0
  var y = 0
  for (var i = 0; i < posHistory.length; i++) {
    x = x + posHistory[i].x
    y = y + posHistory[i].y
  }
  x = x / posHistory.length
  y = y / posHistory.length

  if (lastX !== null && lastY !== null) {
    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    ctx.lineTo(x, y)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.stroke()

    var moved = Math.sqrt((x - lastX) * (x - lastX) + (y - lastY) * (y - lastY))
    if (moved > 3) {
      currentStroke.push({ x: x, y: y })
      if (strokes.length === 0 || strokes[strokes.length - 1] !== currentStroke) {
        strokes.push(currentStroke)
      }
    }
  } else {
    currentStroke = [{ x: x, y: y }]
    strokes.push(currentStroke)
  }

  lastX = x
  lastY = y
})

video.addEventListener('loadeddata', function() {
  async function detectFrame() {
    await mpHands.send({ image: video })
    requestAnimationFrame(detectFrame)
  }
  detectFrame()
})