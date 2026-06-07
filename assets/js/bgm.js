// BGM プレイヤー
// 使い方: bgm.start() / bgm.stop() / bgm.toggle() / bgm.setVolume(0~1)

const bgm = (() => {
  let audio = null;
  let muted = false;

  function getAudio() {
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.volume = 0.5;
    }
    return audio;
  }

  return {
    setSrc(src) {
      getAudio().src = src;
    },
    start() {
      if (muted) return;
      const a = getAudio();
      if (a.src && a.paused) a.play().catch(() => {});
    },
    stop() {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    },
    toggle() {
      muted = !muted;
      if (muted) {
        this.stop();
      } else {
        this.start();
      }
      return !muted;
    },
    setVolume(v) {
      getAudio().volume = v;
    },
    isPlaying() {
      return audio ? !audio.paused : false;
    },
  };
})();
