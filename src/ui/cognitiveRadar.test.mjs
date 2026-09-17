import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNeedleAngle,
  extractThinkBlock,
  speakNarration,
  lockCesiumCameraToReticle,
  renderActionBetrayalCockpit,
} from './cognitiveRadar.js';

test('calculateNeedleAngle maps normalized scores to -90 to +90 degrees', () => {
  assert.equal(calculateNeedleAngle(0.0), -90);
  assert.equal(calculateNeedleAngle(0.5), 0);
  assert.equal(calculateNeedleAngle(1.0), 90);
  assert.equal(calculateNeedleAngle(0.25), -45);
  assert.equal(calculateNeedleAngle(0.75), 45);
  // Clamping
  assert.equal(calculateNeedleAngle(-1.0), -90);
  assert.equal(calculateNeedleAngle(2.5), 90);
});

test('extractThinkBlock extracts <think> inner text or falls back cleanly', () => {
  const trace1 = '<think>Deliberating step by step on network hazards...</think>';
  assert.equal(extractThinkBlock(trace1), 'Deliberating step by step on network hazards...');

  const trace2 = '<think>\n  Multi-line reasoning\n</think>';
  assert.equal(extractThinkBlock(trace2), 'Multi-line reasoning');

  const trace3 = 'Raw reasoning without tags';
  assert.equal(extractThinkBlock(trace3), 'Raw reasoning without tags');

  assert.equal(extractThinkBlock(null), 'No private machine reasoning trace recorded.');
});

test('lockCesiumCameraToReticle calls camera flyTo with destination coordinates', () => {
  let flyOptions = null;
  const mockViewer = {
    camera: {
      flyTo(options) {
        flyOptions = options;
      },
    },
  };

  const reticle = [-0.1276, 51.5074, 50000.0];
  const ok = lockCesiumCameraToReticle(mockViewer, reticle, 1.5);
  assert.equal(ok, true);
  assert.ok(flyOptions);
  assert.equal(flyOptions.duration, 1.5);
});

test('renderActionBetrayalCockpit renders dials, think block, and significant correlation', () => {
  const container = {
    innerHTML: '',
    querySelector(sel) {
      if (sel === '#car-speak-btn') {
        return {
          addEventListener(evt, fn) {
            this.click = fn;
          },
        };
      }
      return null;
    },
  };

  const payload = {
    status: 'success',
    agent_id: 'specimen-77',
    spatial_features: {
      features: [
        {
          properties: {
            agent_id: 'specimen-77',
            model_used: 'deepseek-r1',
            action: 'HOLD',
            stake_amount: 0.0,
            cmd_score: 0.65,
            arc_score: 0.85,
            pf_score: 0.92,
            conviction_rationale: 'Signal appears uncertain. Preserving capital.',
            shadow_trace: '<think>Calculated downside risk outweighs payout ratio.</think>',
          },
        },
      ],
    },
    reticle_target: [6.1432, 46.2044, 60000.0],
    cross_tab: {
      total_decisions: 150,
      actions: {
        HOLD: { count: 90, mean_stake: 0.0, mean_cmd: 0.55, mean_arc: 0.8 },
        BET_LONG: { count: 60, mean_stake: 45.0, mean_cmd: 0.15, mean_arc: 0.3 },
      },
    },
    unrequested_correlation: {
      source_dimension: 'cmd_score',
      target_dimension: 'stake_amount',
      test_type: 'PEARSON',
      statistic: -0.127,
      p_value: 0.00006,
      sample_size: 1000,
      surprise_score: 8.5,
      narrative_template: 'Statistically significant inverse correlation between CMD and committed stake.',
    },
    spoken_narration: 'Telemetry retrieved. Rendering empirical cross-tabulation of stated conviction against executed capital.',
  };

  renderActionBetrayalCockpit(container, payload);

  assert.ok(container.innerHTML.includes('ACTION-BETRAYAL CROSS-TABULATION'));
  assert.ok(container.innerHTML.includes('specimen-77'));
  assert.ok(container.innerHTML.includes('Calculated downside risk outweighs payout ratio.'));
  assert.ok(container.innerHTML.includes('Signal appears uncertain. Preserving capital.'));
  assert.ok(container.innerHTML.includes('SIGNIFICANT CORRELATION'));
  assert.ok(container.innerHTML.includes('Statistically significant inverse correlation'));
  assert.ok(container.innerHTML.includes('cmd_score'));
});

test('renderActionBetrayalCockpit renders clean NULL banner when unrequested_correlation is null', () => {
  const container = {
    innerHTML: '',
    querySelector: () => null,
  };

  const nullPayload = {
    status: 'success',
    agent_id: 'specimen-00',
    spatial_features: { features: [] },
    reticle_target: [-0.1276, 51.5074, 250000.0],
    cross_tab: { total_decisions: 50, actions: {} },
    unrequested_correlation: null,
    spoken_narration: 'Telemetry retrieved. No statistically significant correlation was observed for the queried dimensions.',
  };

  renderActionBetrayalCockpit(container, nullPayload);

  assert.ok(container.innerHTML.includes('UNREQUESTED CORRELATION: NULL'));
  assert.ok(container.innerHTML.includes('No statistically significant correlation'));
});
