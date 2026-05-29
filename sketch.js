const canvas = document.getElementById('drawCanvas')
const video = document.getElementById('videoEl')
const ctx = canvas.getContext('2d')
const overlayCanvas = document.getElementById('overlaySkeletonCanvas')
const octx = overlayCanvas.getContext('2d')

// Referencias UI
const startBtn          = document.getElementById('startBtn')
const gestureStatus     = document.getElementById('gestureStatus')
const bottomStatus      = document.getElementById('bottomStatus')
const messagesList      = document.getElementById('messagesList')
const confirmOverlay    = document.getElementById('confirmOverlay')
const confirmBar        = document.getElementById('confirmBar')
const cameraPlaceholder = document.getElementById('cameraPlaceholder')
const colorGrid         = document.getElementById('colorGrid')

// Botones toolbar
const toolDraw  = document.getElementById('toolDraw')
const toolErase = document.getElementById('toolErase')
const toolRedo  = document.getElementById('toolRedo')
const toolClear = document.getElementById('toolClear')
const toolColor = document.getElementById('toolColor')
const undoBtn   = document.getElementById('undoBtn')
const redoBtn   = document.getElementById('redoBtn')

// Memoria de trazos — declaradas antes de resizeCanvas
var strokes = []
var redoStrokes = []
var currentStroke = []

// Tamaño del canvas al tamaño del contenedor
function resizeCanvas() {
  const wrapper = canvas.parentElement
  canvas.width = wrapper.clientWidth
  canvas.height = wrapper.clientHeight
  redrawAllStrokes()
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

// Variables de dibujo
var lastX = null
var lastY = null
var posHistory = []
var historySize = 5
var lastPinchTime = null
var isPinching = false
var currentColor = '#1e1b4b'

// Paleta de colores
var palette = ['#ffffff','#ffb3c6','#c084fc','#818cf8','#7dd3fc','#6ee7b7','#fde68a','#fdba74','#1e1b4b']
var colorIndex = 0

// Memoria de trazos
var strokes = []
var redoStrokes = []
var currentStroke = []

// Timers de gestos
var lastVTime = null
var lastPinkyTime = null
var openHandStartTime = null

// ── FUNCIÓN: agregar mensaje al panel ──
function addMessage(text) {
  var noMsg = messagesList.querySelector('.no-messages')
  if (noMsg) noMsg.remove()

  var msg = document.createElement('div')
  msg.className = 'message-item'
  msg.textContent = text
  messagesList.appendChild(msg)
  messagesList.scrollTop = messagesList.scrollHeight

  // Actualizamos también el status de abajo
  gestureStatus.textContent = text
  bottomStatus.textContent = text
}

// ── FUNCIÓN: activar botón brevemente ──
function triggerBtn(btn) {
  btn.classList.add('triggered')
  setTimeout(function() {
    btn.classList.remove('triggered')
  }, 400)
}

// ── FUNCIÓN: actualizar color activo ──
function setColor(index) {
  currentColor = palette[index]
  var swatches = colorGrid.querySelectorAll('.color-swatch')
  swatches.forEach(function(s) { s.classList.remove('active') })
  swatches[index].classList.add('active')
}

// Click en swatches
colorGrid.querySelectorAll('.color-swatch').forEach(function(swatch, i) {
  swatch.addEventListener('click', function() {
    colorIndex = i
    setColor(colorIndex)
  })
})

// ── BOTONES CANVAS ──
undoBtn.addEventListener('click', function() {
  if (strokes.length > 0) {
    redoStrokes.push(strokes.pop())
    redrawAllStrokes()
    addMessage('Trazo borrado')
  }
})

redoBtn.addEventListener('click', function() {
  if (redoStrokes.length > 0) {
    strokes.push(redoStrokes.pop())
    redrawAllStrokes()
    addMessage('Trazo rehecho')
  }
})

// ── CÁMARA ──
startBtn.addEventListener('click', function() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(function(stream) {
      video.srcObject = stream
      video.play()
      video.classList.add('active')
      cameraPlaceholder.style.display = 'none'

      // Ajustamos el overlay al tamaño del contenedor de cámara
      var cameraFrame = video.parentElement
      overlayCanvas.width = cameraFrame.clientWidth
      overlayCanvas.height = cameraFrame.clientHeight

      addMessage('Cámara conectada ✦')
    })
})

// ── MEDIAPIPE ──
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

  octx.strokeStyle = 'rgba(196, 181, 253, 0.9)'
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
    octx.fillStyle = '#f9a8d4'
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
    ctx.strokeStyle = stroke.color || currentColor
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
    confirmOverlay.style.display = 'none'
    octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
    addMessage('Esperando mano...')
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

  var isVGesture     = indexUp && middleUp && !ringUp && !pinkyUp
  var isThreeFingers = indexUp && middleUp && ringUp && !pinkyUp
  var isOpenHand     = indexUp && middleUp && ringUp && pinkyUp
  var onlyPinkyUp    = !indexUp && !middleUp && !ringUp && pinkyUp

  var dx = thumbTip.x - indexTip.x
  var dy = thumbTip.y - indexTip.y
  var pinchDistance = Math.sqrt(dx * dx + dy * dy)
  isPinching = pinchDistance < 0.05

  var onlyIndexUp = indexUp && !middleUp && !ringUp && !pinkyUp

  var rawX = (1 - indexTip.x) * canvas.width
  var rawY = indexTip.y * canvas.height

  // ── GESTO: mano abierta — borrar todo ──
  if (isOpenHand) {
    if (openHandStartTime === null) openHandStartTime = Date.now()
    var elapsed = Date.now() - openHandStartTime
    var progress = Math.min((elapsed / 2000) * 100, 100)
    confirmOverlay.style.display = 'block'
    confirmBar.style.width = progress + '%'

    if (elapsed >= 2000) {
      strokes = []
      redoStrokes = []
      currentStroke = []
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      openHandStartTime = null
      confirmOverlay.style.display = 'none'
      triggerBtn(toolClear)
      addMessage('Tablero borrado ✦')
    }

    lastX = null
    lastY = null
    posHistory = []
    return
  } else {
    openHandStartTime = null
    confirmOverlay.style.display = 'none'
  }

  // ── GESTO: meñique solo — cambiar color ──
  if (onlyPinkyUp) {
    if (lastPinkyTime === null || Date.now() - lastPinkyTime > 800) {
      colorIndex = (colorIndex + 1) % palette.length
      setColor(colorIndex)
      triggerBtn(toolColor)
      addMessage('Color cambiado ✦')
      lastPinkyTime = Date.now()
    }
    lastX = null
    lastY = null
    posHistory = []
    return
  }

  // ── GESTO: 3 dedos — rehacer ──
  if (isThreeFingers) {
    if (redoStrokes.length > 0) {
      var strokeToRedo = redoStrokes.pop()
      strokes.push(strokeToRedo)
      redrawAllStrokes()
      triggerBtn(toolRedo)
      triggerBtn(redoBtn)
      addMessage('Trazo rehecho ✦')
    } else {
      addMessage('Nada que rehacer')
    }
    lastX = null
    lastY = null
    posHistory = []
    return
  }

  // ── GESTO: V — borrar último trazo ──
  if (isVGesture) {
    if (lastVTime === null || Date.now() - lastVTime > 1000) {
      currentStroke = []
      if (strokes.length > 0) {
        var removedStroke = strokes.pop()
        redoStrokes.push(removedStroke)
        redrawAllStrokes()
        triggerBtn(toolErase)
        triggerBtn(undoBtn)
        addMessage('Último trazo borrado ✦')
      }
      lastVTime = Date.now()
    }
    lastX = null
    lastY = null
    posHistory = []
    return
  }

  // ── GESTO: pellizco — pausar ──
  if (isPinching) {
    if (currentStroke.length > 1) {
      strokes.push(currentStroke)
      currentStroke = []
    }
    lastX = null
    lastY = null
    posHistory = []
    lastPinchTime = Date.now()
    addMessage('Pausado')
    return
  }

  if (lastPinchTime !== null && Date.now() - lastPinchTime < 600) {
    lastX = null
    lastY = null
    posHistory = []
    return
  }

  // ── Sin gesto de dibujo ──
  if (!onlyIndexUp) {
    if (currentStroke.length > 1) {
      strokes.push(currentStroke)
      currentStroke = []
    }
    lastX = null
    lastY = null
    posHistory = []
    addMessage('Levanta solo el índice para dibujar')
    return
  }

  // ── DIBUJANDO ──
  addMessage('Dibujando ✦')
  redoStrokes = []

  posHistory.push({ x: rawX, y: rawY })
  if (posHistory.length > historySize) posHistory.shift()

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
    ctx.strokeStyle = currentColor
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
    currentStroke = [{ x: x, y: y }, { color: currentColor }]
    strokes.push(currentStroke)
  }

  triggerBtn(toolDraw)
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