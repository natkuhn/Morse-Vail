import "./styles.css";

// based on AtoMV_2022APR11.py by N2LO~> RMEvans
// lots of help from https://stackoverflow.com/a/41094088/1527750
// pause/resume logic from demos described
// here: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume
// end-detection logic is from https://web.dev/audio-scheduling/

let frequency, volume, duration;

const mvs =
  "~ ETINAMSDRGUKWOHBLZFCP_VX_Q[YJ]56@7___8_/>__^_94=___<__3___2_10" +
  "_-__________?)_____,_________________;__|_.________________:____";

let context = null,
  out = null;
let sendUntil; //non-null only when sending
let checker;
let paused = false;

const frequencyElt = document.getElementById("fIn");
frequencyElt.addEventListener("input", frequencyListener);
frequencyListener();

const volumeElt = document.getElementById("vIn");
volumeElt.addEventListener("input", volumeListener);
volumeListener();

const durationElt = document.getElementById("dIn");
durationElt.addEventListener("input", durationListener);
durationListener();

const messageElt = document.getElementById("msg");
messageElt.addEventListener("input", (e) => {
  // deal with Send button
  if (sendUntil) return; //should stay disabled while sending
  enableSend();
});

const sendBtn = document.getElementById("send");
sendBtn.addEventListener("click", (e) => {
  context = new AudioContext();
  out = context.createGain();
  out.connect(context.destination); // connect vol to context destination
  volumeListener(); //set initial volume

  sendUntil = send();
  enable(sendBtn, false);
  enable(frequencyElt, false);
  enable(durationElt, false);
  enable(pauseBtn, true);
  enable(stopBtn, true);
  setPaused(false);
  checker = setInterval(checkTime, 100);
});

const pauseBtn = document.getElementById("pause");
pauseBtn.addEventListener("click", (e) => {
  // console.log("pause/resume", paused);
  if (paused) {
    setPaused(false);
    context.resume();
  } else {
    setPaused(true);
    context.suspend();
  }
});

const stopBtn = document.getElementById("stop");
stopBtn.addEventListener("click", stopSend);

function send() {
  let dit = duration / 1000;
  let dah = dit * 3;
  let space = dit;
  let extraperchar = dit * 2;
  let extraperword = dit * 4;

  let msg = messageElt.value.toUpperCase();
  // console.log(`msg=${msg}`);

  let time = context.currentTime;

  for (var char of msg) {
    let code = mvs.indexOf(char);
    // console.log(`char=${char}, code=${code}`);
    if (code === 1) time += extraperword; //space
    if (code < 2) continue; //space, or not found
    while (code > 1) {
      let dur = code & 1 ? dah : dit;
      // console.log(`time=${time}, duration=${dur}`);
      let osc = context.createOscillator(); // instantiate an oscillator
      osc.frequency.value = frequency;
      osc.connect(out); // connect it to the destination
      osc.start(time); // start it three seconds from now
      time += dur;
      osc.stop(time);
      time += space;
      code >>= 1; //shift right one bid
    }
    time += extraperchar;
  }
  return time;
}

function stopSend() {
  clearInterval(checker);
  context.close().then(() => {
    sendUntil = null;
    setPaused(false);
    enableSend(); //enable if message non-empty
    enable(frequencyElt, true);
    enable(durationElt, true);
    enable(pauseBtn, false);
    enable(stopBtn, false);
  });
}

function checkTime() {
  if (context.currentTime >= sendUntil) stopSend();
}

function frequencyListener() {
  // console.log("freq", this, e);
  frequency = frequencyElt.value;
  document.getElementById("fOut").innerHTML = frequency + " Hz";
}

function volumeListener() {
  volume = volumeElt.value / 100;
  document.getElementById("vOut").innerHTML = volume;
  if (out) out.gain.value = volume * 0.5;
  // from 0 to 1, 1 full volume, 0 is muted
}

function durationListener() {
  duration = durationElt.value;
  document.getElementById("dOut").innerHTML = duration + " ms";
}

function enable(elt, val) {
  if (val) elt.removeAttribute("disabled");
  else elt.setAttribute("disabled", "disabled");
}

function enableSend() {
  enable(sendBtn, !!messageElt.value);
}

function setPaused(val) {
  paused = val;
  pauseBtn.textContent = val ? "Resume" : "Pause";
}
