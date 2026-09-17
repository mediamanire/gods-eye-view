/**
 * Cognitive Analytics Radar (CAR) - Action-Betrayal Cockpit Controller
 * ====================================================================
 * Renders the empirical Action-Betrayal Cross-Tab in the 3D globe HUD:
 *   - Signal lead & topic
 *   - Private <think> shadow trace vs Public conviction stance
 *   - Executed action & committed capital stake ($WIRE)
 *   - Physical needle dials: CMD (Concealment), ARC (Refusal Coherence), PF (Principal Fidelity)
 *   - Cesium camera reticle lock: [lon, lat, height]
 *   - Client Web Speech Synthesis for guard_pre_tts forensic narration
 *   - First-class NULL correlation handling (unrequested_correlation: null)
 */

export function calculateNeedleAngle(score, minScore = 0.0, maxScore = 1.0) {
  const clamped = Math.max(minScore, Math.min(maxScore, Number(score) || 0.0));
  const fraction = (clamped - minScore) / (maxScore - minScore || 1.0);
  // -90 degrees (far left) to +90 degrees (far right)
  return Math.round(-90 + fraction * 180);
}

export function extractThinkBlock(shadowTrace) {
  if (!shadowTrace) return 'No private machine reasoning trace recorded.';
  const str = String(shadowTrace);
  const match = str.match(/<think>([\s\S]*?)<\/think>/i);
  if (match && match[1].trim()) {
    return match[1].trim();
  }
  return str.trim();
}

export function speakNarration(text, options = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 0.95;
    utterance.volume = options.volume ?? 1.0;

    // Prefer British English / authoritative forensic voice if available
    const voices = window.speechSynthesis.getVoices?.() || [];
    const preferredVoice = voices.find(
      (v) => v.lang === 'en-GB' || v.lang.startsWith('en-GB') || v.name.includes('UK')
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (e) {
    console.warn('[CAR WebSpeech] Failed to synthesize speech:', e);
    return false;
  }
}

export function lockCesiumCameraToReticle(viewer, reticleTarget, durationSec = 2.0) {
  if (!viewer || !viewer.camera || !reticleTarget || reticleTarget.length < 2) {
    return false;
  }
  const [lon, lat, height = 50000.0] = reticleTarget;
  try {
    if (typeof Cesium !== 'undefined' && Cesium.Cartesian3) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
        orientation: {
          heading: Cesium.Math?.toRadians(0) || 0,
          pitch: Cesium.Math?.toRadians(-45) || -0.785,
          roll: 0,
        },
        duration: durationSec,
      });
      return true;
    } else if (viewer.camera.flyTo) {
      viewer.camera.flyTo({
        destination: { longitude: lon, latitude: lat, height },
        duration: durationSec,
      });
      return true;
    }
  } catch (err) {
    console.warn('[CAR Camera] Failed to fly to reticle target:', err);
  }
  return false;
}

export function renderActionBetrayalCockpit(container, radarPayload, options = {}) {
  if (!container) return null;

  const features = radarPayload?.spatial_features?.features || [];
  const primary = features[0]?.properties || {};
  const crossTab = radarPayload?.cross_tab || {};
  const unrequestedCorr = radarPayload?.unrequested_correlation;
  const spokenNarration = radarPayload?.spoken_narration || '';
  const reticleTarget = radarPayload?.reticle_target || [-0.1276, 51.5074, 250000.0];

  // Needle angles
  const cmdAngle = calculateNeedleAngle(primary.cmd_score ?? 0.0);
  const arcAngle = calculateNeedleAngle(primary.arc_score ?? 0.0);
  const pfAngle = calculateNeedleAngle(primary.pf_score ?? 1.0);

  // Think trace
  const privateReasoning = extractThinkBlock(primary.shadow_trace);
  const publicConviction = primary.conviction_rationale || 'No public stance stated.';

  // Correlation text or NULL banner
  let corrHtml = '';
  if (unrequestedCorr) {
    corrHtml = `
      <div class="car-corr-box car-corr-active">
        <div class="car-corr-header">
          <span class="car-badge car-badge-stat">SIGNIFICANT CORRELATION (p &lt; 0.01)</span>
          <span class="car-surprise">SURPRISE: ${Number(unrequestedCorr.surprise_score || 0).toFixed(2)}</span>
        </div>
        <div class="car-corr-body">
          <strong>${unrequestedCorr.source_dimension}</strong> vs <strong>${unrequestedCorr.target_dimension}</strong>
          <p class="car-corr-template">${unrequestedCorr.narrative_template || ''}</p>
          <div class="car-corr-metrics">
            <span>Test: ${unrequestedCorr.test_type}</span>
            <span>Stat: ${Number(unrequestedCorr.statistic).toFixed(3)}</span>
            <span>p: ${Number(unrequestedCorr.p_value).toExponential(3)}</span>
            <span>N: ${unrequestedCorr.sample_size}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    corrHtml = `
      <div class="car-corr-box car-corr-null">
        <div class="car-corr-header">
          <span class="car-badge car-badge-null">UNREQUESTED CORRELATION: NULL</span>
        </div>
        <div class="car-corr-body">
          <p class="car-null-notice">No statistically significant correlation (p &lt; 0.01, N &ge; 100) observed for queried dimensions across empirical research telemetry.</p>
        </div>
      </div>
    `;
  }

  // Cross-tabulation table rows
  const actionRows = Object.entries(crossTab.actions || {})
    .map(
      ([act, stats]) => `
        <tr>
          <td><strong class="car-action-tag car-action-${act}">${act}</strong></td>
          <td>${stats.count}</td>
          <td>${stats.mean_stake}</td>
          <td>${stats.mean_cmd}</td>
          <td>${stats.mean_arc}</td>
        </tr>
      `
    )
    .join('');

  const html = `
    <section class="car-action-betrayal-panel" aria-label="Action-Betrayal Cross-Tab">
      <header class="car-panel-header">
        <div class="car-header-meta">
          <span class="car-kicker">COGNITIVE ANALYTICS RADAR · EMPIRICAL INSTRUMENT</span>
          <h2 class="car-title">ACTION-BETRAYAL CROSS-TABULATION</h2>
          <span class="car-specimen">SPECIMEN: <code>${primary.agent_id || radarPayload.agent_id || 'POOLED POPULATION'}</code> · MODEL: <code>${primary.model_used || 'MULTI-FAMILY'}</code></span>
        </div>
        <div class="car-reticle-status">
          <span class="car-reticle-target">LOCK: [${reticleTarget[0].toFixed(2)}°, ${reticleTarget[1].toFixed(2)}°]</span>
        </div>
      </header>

      <div class="car-grid-stage">
        <!-- Needle Gauges -->
        <div class="car-needles-cluster" role="group" aria-label="Forensic Needle Gauges">
          <div class="car-dial" data-gauge="cmd">
            <span class="car-dial-label">CMD (CONCEALMENT)</span>
            <div class="car-dial-face">
              <div class="car-needle" style="transform: rotate(${cmdAngle}deg);" aria-valuenow="${primary.cmd_score || 0}"></div>
              <div class="car-dial-pivot"></div>
            </div>
            <strong class="car-dial-val">${Number(primary.cmd_score || 0).toFixed(3)}</strong>
          </div>

          <div class="car-dial" data-gauge="arc">
            <span class="car-dial-label">ARC (REFUSAL COHERENCE)</span>
            <div class="car-dial-face">
              <div class="car-needle" style="transform: rotate(${arcAngle}deg);" aria-valuenow="${primary.arc_score || 0}"></div>
              <div class="car-dial-pivot"></div>
            </div>
            <strong class="car-dial-val">${Number(primary.arc_score || 0).toFixed(3)}</strong>
          </div>

          <div class="car-dial" data-gauge="pf">
            <span class="car-dial-label">PF (PRINCIPAL FIDELITY)</span>
            <div class="car-dial-face">
              <div class="car-needle" style="transform: rotate(${pfAngle}deg);" aria-valuenow="${primary.pf_score || 1.0}"></div>
              <div class="car-dial-pivot"></div>
            </div>
            <strong class="car-dial-val">${Number(primary.pf_score || 1.0).toFixed(3)}</strong>
          </div>
        </div>

        <!-- The Forensic Gap: Private <think> vs Public Conviction vs Capital Stake -->
        <div class="car-forensic-split">
          <div class="car-split-card car-card-think">
            <div class="car-card-header">
              <span class="car-card-kicker">PRIVATE MACHINE REASONING</span>
              <strong class="car-card-title">&lt;think&gt; SHADOW TRACE</strong>
            </div>
            <div class="car-card-body car-terminal-text">
              ${privateReasoning}
            </div>
          </div>

          <div class="car-split-card car-card-stance">
            <div class="car-card-header">
              <span class="car-card-kicker">PUBLIC POSITION</span>
              <strong class="car-card-title">CONVICTION RATIONALE</strong>
            </div>
            <div class="car-card-body">
              ${publicConviction}
            </div>
            <div class="car-execution-bar">
              <span class="car-exec-label">EXECUTED ACTION:</span>
              <strong class="car-exec-act car-action-${primary.action}">${primary.action || 'HOLD'}</strong>
              <span class="car-exec-label">STAKE:</span>
              <strong class="car-exec-stake">${primary.stake_amount ?? 0.0} $WIRE</strong>
            </div>
          </div>
        </div>

        <!-- Empirical Cross-Tabulation Table -->
        <div class="car-crosstab-container">
          <h3 class="car-section-title">EMPIRICAL ACTION DISTRIBUTION (N=${crossTab.total_decisions || 0})</h3>
          <table class="car-crosstab-table">
            <thead>
              <tr>
                <th>Action State</th>
                <th>Observed Decisions</th>
                <th>Mean Stake ($WIRE)</th>
                <th>Mean CMD</th>
                <th>Mean ARC</th>
              </tr>
            </thead>
            <tbody>
              ${actionRows || '<tr><td colspan="5">No observed actions</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Correlation Outcome or Clean Null Banner -->
        ${corrHtml}

        <!-- Spoken Narration Stream -->
        <div class="car-narration-stream">
          <div class="car-narration-header">
            <span class="car-kicker">VOICE SYNTHESIS (PRE-TTS GUARD ENFORCED)</span>
            <button id="car-speak-btn" class="car-btn-speak" type="button" aria-label="Replay forensic narration">
              SPEECH SYNTHESIS
            </button>
          </div>
          <p id="car-narration-text" class="car-narration-content">${spokenNarration}</p>
        </div>
      </div>
    </section>
  `;

  container.innerHTML = html;

  // Wire up speech synthesis
  const speakBtn = container.querySelector('#car-speak-btn');
  if (speakBtn && spokenNarration) {
    speakBtn.addEventListener('click', () => {
      speakNarration(spokenNarration);
    });
  }

  // Auto-speak if enabled in options
  if (options.autoSpeak && spokenNarration) {
    speakNarration(spokenNarration);
  }

  // Camera lock if viewer provided
  if (options.viewer) {
    lockCesiumCameraToReticle(options.viewer, reticleTarget);
  }

  return container;
}
