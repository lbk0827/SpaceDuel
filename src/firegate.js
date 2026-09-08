// 발사 제약 상태기계. tuning 을 참조로 들고 있어 모드·값이 실시간으로 바뀌어도 다음 판정부터 반영된다.
// cooldown: 한 발 뒤 cooldown 초 대기 / energy: 최대 energyMax 발, energyRegen 초마다 1발 충전.

export function createFireGate(tuning) {
  let cdRemaining = 0;
  let energy = tuning.energyMax;

  return {
    /** 소비 없이 발사 가능 여부만 (AI 판단용) */
    canFire() {
      return tuning.fireMode === 'energy' ? energy >= 1 : cdRemaining <= 0;
    },
    tryFire() {
      if (tuning.fireMode === 'energy') {
        if (energy < 1) return false;
        energy -= 1;
        return true;
      }
      if (cdRemaining > 0) return false;
      cdRemaining = tuning.cooldown;
      return true;
    },
    update(dt) {
      cdRemaining = Math.max(0, cdRemaining - dt);
      energy = Math.min(tuning.energyMax, energy + dt / tuning.energyRegen);
    },
    reset() {
      cdRemaining = 0;
      energy = tuning.energyMax;
    },
    state() {
      return {
        mode: tuning.fireMode,
        ready: tuning.cooldown > 0 ? 1 - cdRemaining / tuning.cooldown : 1,
        energy,
        max: tuning.energyMax,
      };
    },
  };
}
