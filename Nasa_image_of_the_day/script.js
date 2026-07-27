(function(){
  "use strict";

  var START_DATE = new Date(Date.UTC(1995, 5, 16)); // APOD's first plate
  var apiKey = "1cP26nNfhxRLoXl88DTB6u1KmFnxjSuPcZtUImcp";
  var current = new Date(); // today, UTC-normalized below

  function toUTCDateOnly(d){
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  current = toUTCDateOnly(new Date());

  function fmtISO(d){
    return d.toISOString().slice(0,10);
  }
  function fmtLong(d){
    return d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric', timeZone:'UTC' });
  }
  function plateNumber(d){
    var diff = Math.round((d - START_DATE) / 86400000) + 1;
    return diff;
  }

  var els = {
    issueLine: document.getElementById('issue-line'),
    figTop: document.getElementById('fig-top'),
    figBottom: document.getElementById('fig-bottom'),
    mediaSlot: document.getElementById('media-slot'),
    title: document.getElementById('apod-title'),
    metaDate: document.getElementById('meta-date'),
    metaMedium: document.getElementById('meta-medium'),
    metaCredit: document.getElementById('meta-credit'),
    explanation: document.getElementById('apod-explanation'),
    dateInput: document.getElementById('date-input'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnToday: document.getElementById('btn-today'),
    btnRandom: document.getElementById('btn-random'),
    apiKeyInput: document.getElementById('api-key-input'),
    btnSaveKey: document.getElementById('btn-save-key')
  };

  els.dateInput.max = fmtISO(current);
  els.dateInput.min = fmtISO(START_DATE);

  function setLoading(){
    els.mediaSlot.innerHTML = '<div class="plate-loading">DEVELOPING PLATE…</div>';
  }

  function setError(message){
    els.mediaSlot.innerHTML = '<div class="plate-error">✦ ' + message + '</div>';
  }

  function updateButtons(){
    els.btnNext.disabled = fmtISO(current) >= fmtISO(toUTCDateOnly(new Date()));
    els.btnPrev.disabled = fmtISO(current) <= fmtISO(START_DATE);
  }

  function render(data){
    var num = plateNumber(current);
    var padded = String(num).padStart(3,'0');

    els.issueLine.textContent = 'Plate No. ' + padded + ' · ' + fmtLong(current);
    els.figTop.textContent = 'FIG. ' + padded;
    els.figBottom.textContent = data.media_type === 'video' ? 'RECORDING' : 'PHOTOGRAPHIC PLATE';

    els.title.textContent = data.title || 'Untitled Observation';
    els.metaDate.textContent = data.date || fmtISO(current);
    els.metaMedium.textContent = data.media_type === 'video' ? 'Video' : 'Photograph';
    els.metaCredit.textContent = data.copyright ? data.copyright.trim() : 'Public Domain / NASA';

    var paragraphs = (data.explanation || '').split(/\n{2,}/);
    if (paragraphs.length === 1) {
      paragraphs = [data.explanation || 'No observation notes were filed for this plate.'];
    }
    els.explanation.innerHTML = paragraphs.map(function(p){ return '<p>' + p + '</p>'; }).join('');

    if (data.media_type === 'image') {
      var src = data.hdurl || data.url;
      els.mediaSlot.innerHTML = '<img id="plate-img" alt="' + (data.title ? data.title.replace(/"/g,'&quot;') : 'NASA image of the day') + '">';
      var img = document.getElementById('plate-img');
      img.addEventListener('load', function(){
        img.classList.add('developing');
      });
      img.src = src;
    } else if (data.media_type === 'video') {
      els.mediaSlot.innerHTML = '<iframe src="' + data.url + '" title="NASA video of the day" frameborder="0" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    } else {
      setError('This plate has an unsupported medium: ' + data.media_type);
    }
  }

  function fetchAPOD(dateObj){
    setLoading();
    els.title.textContent = 'Loading title…';
    els.explanation.innerHTML = '<p>Retrieving the day\'s observation notes…</p>';
    var iso = fmtISO(dateObj);
    var url = 'https://api.nasa.gov/planetary/apod?api_key=' + encodeURIComponent(apiKey) + '&date=' + iso;

    fetch(url)
      .then(function(res){
        if (!res.ok) {
          if (res.status === 429) {
            throw new Error('RATE_LIMIT');
          }
          throw new Error('HTTP_' + res.status);
        }
        return res.json();
      })
      .then(function(data){
        if (data.code && data.code !== 200) {
          throw new Error(data.msg || 'API_ERROR');
        }
        render(data);
        els.dateInput.value = iso;
        updateButtons();
      })
      .catch(function(err){
        var msg = 'The observatory could not retrieve this plate.';
        if (err.message === 'RATE_LIMIT') {
          msg = 'Rate limit reached on the shared key — open "Observatory access" below and enter your own free API key.';
        } else if (err.message && err.message.indexOf('HTTP_') === 0) {
          msg = 'The archive returned an error (' + err.message.replace('HTTP_','') + ').';
        }
        setError(msg);
        els.title.textContent = 'Plate unavailable';
        els.explanation.innerHTML = '<p>No notes could be filed for this date.</p>';
      });
  }

  function goTo(dateObj){
    current = toUTCDateOnly(dateObj);
    fetchAPOD(current);
  }

  els.btnPrev.addEventListener('click', function(){
    var d = new Date(current);
    d.setUTCDate(d.getUTCDate() - 1);
    goTo(d);
  });

  els.btnNext.addEventListener('click', function(){
    var d = new Date(current);
    d.setUTCDate(d.getUTCDate() + 1);
    goTo(d);
  });

  els.btnToday.addEventListener('click', function(){
    goTo(new Date());
  });

  els.btnRandom.addEventListener('click', function(){
    var startTime = START_DATE.getTime();
    var endTime = toUTCDateOnly(new Date()).getTime();
    var randomTime = startTime + Math.random() * (endTime - startTime);
    goTo(new Date(randomTime));
  });

  els.dateInput.addEventListener('change', function(){
    if (!els.dateInput.value) return;
    var parts = els.dateInput.value.split('-').map(Number);
    goTo(new Date(Date.UTC(parts[0], parts[1]-1, parts[2])));
  });

  els.btnSaveKey.addEventListener('click', function(){
    var val = els.apiKeyInput.value.trim();
    apiKey = val || 'DEMO_KEY';
    fetchAPOD(current);
  });

  // Initial load
  goTo(new Date());
})();