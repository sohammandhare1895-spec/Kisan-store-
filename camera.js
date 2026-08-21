/* ═══════════════════════════════════════════════════════════════
   Kisan Store — camera.js
   The DAILY FARM CHECK-IN system (Logic 5):
     • Opens the device camera (getUserMedia)
     • Farmer captures ≥3 photos + 1 video (≥5 seconds)
     • Writes a short description of the daily farm work
     • Media is stored in the browser vault (IndexedDB) and —
       when the optional backend is running — uploaded to the server
     • A successful check-in adds +5 coins to the wallet (once/day)
   Rules come from data/catalog.json → rewards.*
   ═══════════════════════════════════════════════════════════════ */

import { getRewardRules, esc } from './data.js';
import {
  saveUpload, recordCheckin, hasCheckedInToday, syncCheckinToBackend
} from './store.js';
import { toast, openModal, closeModal } from './ui.js';
import { renderWallet, renderCheckinPanel, renderGallery } from './render.js';

const RULES = getRewardRules();

/* ── Capture session state ── */
const session = {
  stream: null,
  photos: [],          // Blob[]
  videoBlob: null,
  videoSeconds: 0,
  recording: false,
  recorder: null,
  chunks: [],
  recStartAt: 0,
  recTimerId: null
};

const MAX_PHOTOS = 6;   // allow a couple of extras beyond the 3 required
const VIDEO_MIN = RULES.minVideoSeconds;

/* ── MediaRecorder mime picker (browser support matrix) ── */
function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

/* ── Camera lifecycle ── */
export async function openCamera() {
  if (hasCheckedInToday()) {
    toast('✅ You already completed today\'s check-in. Come back tomorrow!', 'info');
    return;
  }
  openModal('cameraModal');
  const errorEl = document.getElementById('cameraError');
  errorEl.hidden = true;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraError('Your browser does not support camera access. Use Chrome/Edge on a phone or laptop.');
    return;
  }

  try {
    session.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true
    });
    const video = document.getElementById('videoPreview');
    video.srcObject = session.stream;
    video.hidden = false;
    document.getElementById('camOffline').hidden = true;
    document.getElementById('captureBtn').disabled = false;
    document.getElementById('recordBtn').disabled = false;
    toast('📷 Camera is live — capture your farm!', 'info');
  } catch (err) {
    if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
      showCameraError('Camera permission denied. Allow camera access in your browser settings and try again.');
    } else if (err && err.name === 'NotFoundError') {
      showCameraError('No camera found on this device.');
    } else {
      showCameraError('Could not start camera: ' + (err && err.message ? err.message : 'unknown error'));
    }
  }
}

function showCameraError(msg) {
  const errorEl = document.getElementById('cameraError');
  if (errorEl) {
    errorEl.textContent = '⚠️ ' + msg;
    errorEl.hidden = false;
  }
}

export function closeCamera() {
  stopStream();
  closeModal('cameraModal');
}

function stopStream() {
  if (session.recorder && session.recorder.state !== 'inactive') {
    try { session.recorder.stop(); } catch { /* noop */ }
  }
  stopRecTimer();
  session.recording = false;
  if (session.stream) {
    session.stream.getTracks().forEach(t => t.stop());
    session.stream = null;
  }
  const video = document.getElementById('videoPreview');
  if (video) video.srcObject = null;
}

/* ── Photo capture ── */
export function capturePhoto() {
  if (!session.stream) return;
  if (session.photos.length >= MAX_PHOTOS) {
    toast('You already have ' + MAX_PHOTOS + ' photos — that\'s plenty! Submit the check-in.', 'info');
    return;
  }
  const video = document.getElementById('videoPreview');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    if (!blob) return;
    session.photos.push(blob);
    renderStrip();
    updateChips();
    updateSubmitState();
    if (session.photos.length >= RULES.minPhotos) {
      toast('📸 ' + session.photos.length + ' photos captured — keep going!');
    }
  }, 'image/jpeg', 0.85);
}

/* ── Video recording ── */
export function startRecording() {
  if (!session.stream || session.recording) return;
  try {
    const mime = pickMimeType();
    session.recorder = new MediaRecorder(session.stream, mime ? { mimeType: mime } : undefined);
  } catch {
    try { session.recorder = new MediaRecorder(session.stream); } catch { return; }
  }
  session.chunks = [];
  session.recorder.ondataavailable = e => { if (e.data && e.data.size > 0) session.chunks.push(e.data); };
  session.recorder.onstop = () => {
    const blob = new Blob(session.chunks, { type: session.recorder.mimeType || 'video/webm' });
    session.videoBlob = blob;
    session.recording = false;
    stopRecTimer();
    document.getElementById('recordBtn').hidden = false;
    document.getElementById('stopRecordBtn').hidden = true;
    document.getElementById('recordDot').hidden = true;
    document.getElementById('recordTimer').hidden = true;
    if (session.videoSeconds >= VIDEO_MIN) {
      toast('🎥 Video saved — ' + session.videoSeconds + 's recorded!');
    } else {
      toast('Video was under ' + VIDEO_MIN + 's — please record again.', 'error');
    }
    renderStrip();
    updateChips();
    updateSubmitState();
  };

  session.recorder.start(250);
  session.recording = true;
  session.recStartAt = Date.now();
  document.getElementById('recordBtn').hidden = true;
  document.getElementById('stopRecordBtn').hidden = false;
  document.getElementById('recordDot').hidden = false;
  const timerEl = document.getElementById('recordTimer');
  timerEl.hidden = false;
  timerEl.textContent = '00:00';
  session.recTimerId = setInterval(() => {
    const secs = Math.floor((Date.now() - session.recStartAt) / 1000);
    session.videoSeconds = secs;
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    timerEl.textContent = mm + ':' + ss;
    timerEl.style.color = secs >= VIDEO_MIN ? '#7CFC00' : '#fff';
    if (secs >= VIDEO_MIN) {
      document.getElementById('stopRecordBtn').innerHTML =
        '<i class="fas fa-stop"></i> Stop ✓ (' + secs + 's)';
    } else {
      document.getElementById('stopRecordBtn').innerHTML =
        '<i class="fas fa-stop"></i> Stop (' + secs + '/' + VIDEO_MIN + 's min)';
    }
  }, 250);
}

export function stopRecording() {
  if (session.recorder && session.recorder.state !== 'inactive') {
    session.recorder.stop();
  }
}

function stopRecTimer() {
  if (session.recTimerId) {
    clearInterval(session.recTimerId);
    session.recTimerId = null;
  }
}

/* ── Retake everything ── */
export function retakeAll() {
  session.photos = [];
  session.videoBlob = null;
  session.videoSeconds = 0;
  renderStrip();
  updateChips();
  updateSubmitState();
  toast('Cleared captures — start again!', 'info');
}

/* ── Strip / chips UI ── */
function renderStrip() {
  const strip = document.getElementById('photoStrip');
  if (!strip) return;
  strip.innerHTML = '';
  session.photos.forEach((blob, i) => {
    const url = URL.createObjectURL(blob);
    const wrap = document.createElement('div');
    wrap.className = 'photo-item';
    wrap.innerHTML = `
      <img src="${url}" alt="photo ${i + 1}" />
      <span class="photo-badge">📷 #${i + 1}</span>
      <button class="del-photo" title="Delete photo" data-photo-idx="${i}">×</button>`;
    wrap.querySelector('.del-photo').addEventListener('click', () => {
      session.photos.splice(i, 1);
      renderStrip();
      updateChips();
      updateSubmitState();
    });
    strip.appendChild(wrap);
  });
  if (session.videoBlob) {
    const url = URL.createObjectURL(session.videoBlob);
    const wrap = document.createElement('div');
    wrap.className = 'photo-item';
    wrap.innerHTML = `
      <video src="${url}" muted loop playsinline></video>
      <span class="photo-badge">🎥 ${session.videoSeconds}s</span>
      <button class="del-photo" title="Delete video">×</button>`;
    wrap.querySelector('video').addEventListener('click', () => { wrap.querySelector('video').play(); });
    wrap.querySelector('.del-photo').addEventListener('click', () => {
      session.videoBlob = null;
      session.videoSeconds = 0;
      renderStrip();
      updateChips();
      updateSubmitState();
    });
    strip.appendChild(wrap);
  }
}

function updateChips() {
  const chipPhoto = document.getElementById('chipPhotos');
  const chipVideo = document.getElementById('chipVideo');
  const chipDesc = document.getElementById('chipDesc');
  const photoCountBtn = document.getElementById('photoCountBtn');

  if (chipPhoto) {
    const done = session.photos.length >= RULES.minPhotos;
    chipPhoto.classList.toggle('done', done);
    chipPhoto.innerHTML = `<i class="fas fa-image"></i> Photos <b>${session.photos.length}/${RULES.minPhotos}</b>`;
  }
  if (chipVideo) {
    const ok = !!session.videoBlob && session.videoSeconds >= VIDEO_MIN;
    chipVideo.classList.toggle('done', ok);
    chipVideo.innerHTML = `<i class="fas fa-video"></i> Video <b>${ok ? '1/1 ✓' : '0/1'}</b>`;
  }
  if (chipDesc) {
    const len = (document.getElementById('checkinDesc')?.value || '').trim().length;
    const ok = len >= RULES.minDescriptionChars;
    chipDesc.classList.toggle('done', ok);
    chipDesc.innerHTML = `<i class="fas fa-pen"></i> Description <b>${Math.min(len, RULES.minDescriptionChars)}/${RULES.minDescriptionChars}${ok ? ' ✓' : ''}</b>`;
  }
  if (photoCountBtn) photoCountBtn.textContent = session.photos.length;
}

export function updateChipsPublic() { updateChips(); }

/* ── Submit validation & flow ── */
export function refreshSubmitState() {
  updateChips();
  updateSubmitState();
}

function updateSubmitState() {
  const btn = document.getElementById('submitCheckinBtn');
  if (!btn) return;
  const descOk = (document.getElementById('checkinDesc')?.value || '').trim().length >= RULES.minDescriptionChars;
  const photosOk = session.photos.length >= RULES.minPhotos;
  const videoOk = !!session.videoBlob && session.videoSeconds >= VIDEO_MIN;
  const complete = photosOk && videoOk && descOk;
  btn.disabled = !complete;
  if (!complete) {
    btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Need: ${!photosOk ? '📷 ' + (RULES.minPhotos - session.photos.length) + ' more photo(s) · ' : ''}${!videoOk ? '🎥 1 video ≥' + VIDEO_MIN + 's · ' : ''}${!descOk ? '✍️ description' : ''}`;
  } else {
    btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Submit Check-in & Earn +5 Coins';
  }
}

export async function submitCheckin() {
  const desc = (document.getElementById('checkinDesc')?.value || '').trim();
  const photosOk = session.photos.length >= RULES.minPhotos;
  const videoOk = !!session.videoBlob && session.videoSeconds >= VIDEO_MIN;
  const descOk = desc.length >= RULES.minDescriptionChars;

  if (!photosOk || !videoOk || !descOk) {
    const err = document.getElementById('checkinError');
    err.innerHTML = `❌ Check-in incomplete — you need <strong>${RULES.minPhotos} photos</strong> (have ${session.photos.length}), <strong>1 video ≥ ${VIDEO_MIN}s</strong>${session.videoBlob ? ' (have ' + session.videoSeconds + 's)' : ''} and a <strong>description ≥ ${RULES.minDescriptionChars} characters</strong>.`;
    err.hidden = false;
    return;
  }

  const submitBtn = document.getElementById('submitCheckinBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving your check-in…';

  const uploadIds = [];
  const descForStorage = desc;
  const uploadPromises = [];

  // 1) Save all media into the local vault (IndexedDB)
  for (const blob of session.photos) {
    uploadPromises.push(
      saveUpload({ type: 'photo', blob, description: descForStorage }).then(r => uploadIds.push(r.id))
    );
  }
  uploadPromises.push(
    saveUpload({ type: 'video', blob: session.videoBlob, description: descForStorage }).then(r => uploadIds.push(r.id))
  );
  await Promise.allSettled(uploadPromises);

  // 2) Award the coins & record the check-in
  recordCheckin({
    photos: session.photos.length,
    videoSeconds: session.videoSeconds,
    description: descForStorage,
    uploadIds
  });

  // 3) Try to sync to the backend if one is running (fire & forget)
  const files = session.photos.map((blob, i) => new File([blob], `farm-${Date.now()}-${i + 1}.jpg`, { type: blob.type }));
  const videoFile = new File([session.videoBlob], `farm-${Date.now()}-video.webm`, { type: session.videoBlob.type || 'video/webm' });
  syncCheckinToBackend({ photos: files, video: videoFile, description: descForStorage })
    .then(res => {
      if (res && res.ok) toast('☁️ Check-in synced to the Kisan Store server!');
    })
    .catch(() => { /* offline mode — media stays local */ });

  // 4) Reset the session & refresh UI
  session.photos = [];
  session.videoBlob = null;
  session.videoSeconds = 0;
  document.getElementById('checkinDesc').value = '';
  document.getElementById('checkinError').hidden = true;
  renderStrip();
  closeCamera();
  renderWallet();
  renderCheckinPanel();
  renderGallery();
  toast(`🎉 Check-in accepted! <strong>+${RULES.dailyCheckinCoins} coins</strong> added to your wallet.`);
}

/* ── Wire up all camera UI events ── */
export function initCameraUI() {
  document.getElementById('openCameraBtn')?.addEventListener('click', openCamera);
  document.getElementById('openCameraFromEarn')?.addEventListener('click', () => {
    closeModal('earnModal');
    openCamera();
  });
  document.querySelector('[data-close="cameraModal"]')?.addEventListener('click', closeCamera);
  document.getElementById('captureBtn')?.addEventListener('click', capturePhoto);
  document.getElementById('recordBtn')?.addEventListener('click', startRecording);
  document.getElementById('stopRecordBtn')?.addEventListener('click', stopRecording);
  document.getElementById('retakeBtn')?.addEventListener('click', retakeAll);
  document.getElementById('submitCheckinBtn')?.addEventListener('click', submitCheckin);
  document.getElementById('checkinDesc')?.addEventListener('input', refreshSubmitState);

  // When the camera modal is closed via overlay/Esc, also stop the stream
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('mousedown', () => {
      const camModal = document.getElementById('cameraModal');
      if (camModal && camModal.hidden) stopStream();
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const camModal = document.getElementById('cameraModal');
      if (camModal && camModal.hidden) stopStream();
    }
  });
}

export { esc };
