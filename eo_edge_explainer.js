/**
 * EO Edge Explainer UI - Visual Explanation of Typed Edges
 *
 * This component provides an interactive interface that explains:
 * 1. What edge types exist and what they mean
 * 2. How edges behave differently based on entity types
 * 3. How EO roles affect edge interpretation (susceptibility)
 * 4. Why the system is behaving the way it is
 *
 * The goal is to make the edge system understandable without requiring
 * users to learn EO terminology.
 */

// ============================================================================
// EDGE EXPLAINER PANEL
// ============================================================================

/**
 * Create an Edge Explainer panel
 */
function createEdgeExplainerPanel(container) {
  const panel = document.createElement('div');
  panel.className = 'edge-explainer-panel';

  panel.innerHTML = `
    <div class="ee-header">
      <h2>How Relationships Work</h2>
      <p class="ee-subtitle">Understanding typed edges and their effects</p>
    </div>

    <div class="ee-tabs">
      <button class="ee-tab active" data-tab="overview">Overview</button>
      <button class="ee-tab" data-tab="edge-types">Edge Types</button>
      <button class="ee-tab" data-tab="entity-pairs">Entity Pairs</button>
      <button class="ee-tab" data-tab="behavior-modes">Behavior Modes</button>
    </div>

    <div class="ee-content">
      <div class="ee-tab-content active" id="tab-overview">
        ${renderOverviewTab()}
      </div>
      <div class="ee-tab-content" id="tab-edge-types">
        ${renderEdgeTypesTab()}
      </div>
      <div class="ee-tab-content" id="tab-entity-pairs">
        ${renderEntityPairsTab()}
      </div>
      <div class="ee-tab-content" id="tab-behavior-modes">
        ${renderBehaviorModesTab()}
      </div>
    </div>
  `;

  // Add styles
  if (!document.getElementById('edge-explainer-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'edge-explainer-styles';
    styleEl.textContent = edgeExplainerStyles;
    document.head.appendChild(styleEl);
  }

  // Setup tabs
  panel.querySelectorAll('.ee-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.ee-tab').forEach(t => t.classList.remove('active'));
      panel.querySelectorAll('.ee-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      panel.querySelector(`#tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  container.appendChild(panel);
  return panel;
}

// ============================================================================
// TAB CONTENT RENDERERS
// ============================================================================

function renderOverviewTab() {
  return `
    <div class="ee-section">
      <h3>The Core Principle</h3>
      <div class="ee-principle-box">
        <p><strong>Edges express relationships.</strong></p>
        <p>Entity types determine the rules of interpretation.</p>
        <p>Behavior modes determine how strongly reactions occur.</p>
      </div>

      <div class="ee-key-insight">
        <div class="ee-insight-icon">💡</div>
        <div class="ee-insight-text">
          <strong>Same edge + different entities = different consequences</strong>
          <p>A "depends on" relationship between a Rule and a Definition is very different from one between two Definitions. The system interprets each combination differently.</p>
        </div>
      </div>
    </div>

    <div class="ee-section">
      <h3>How Risk is Calculated</h3>
      <div class="ee-formula">
        <div class="ee-formula-item">
          <span class="ee-formula-label">Base Effect</span>
          <span class="ee-formula-desc">From edge type + entity pair</span>
        </div>
        <span class="ee-formula-op">×</span>
        <div class="ee-formula-item">
          <span class="ee-formula-label">Susceptibility</span>
          <span class="ee-formula-desc">From behavior mode</span>
        </div>
        <span class="ee-formula-op">=</span>
        <div class="ee-formula-item">
          <span class="ee-formula-label">Actual Risk</span>
          <span class="ee-formula-desc">What the system shows</span>
        </div>
      </div>
    </div>

    <div class="ee-section">
      <h3>Why This Matters</h3>
      <ul class="ee-benefits">
        <li><strong>Predictable behavior:</strong> The same pattern always produces the same result</li>
        <li><strong>Explainable decisions:</strong> Every risk assessment can be traced back to specific edges</li>
        <li><strong>"What if" analysis:</strong> Simulate changes before making them</li>
        <li><strong>Governance support:</strong> The system can enforce policies based on edge patterns</li>
      </ul>
    </div>
  `;
}

function renderEdgeTypesTab() {
  const categories = [
    {
      name: 'Semantic Edges',
      color: '#7856ff',
      description: 'Relationships about meaning and definition',
      edges: [
        { type: 'DEFINES_MEANING_OF', symbol: '→', desc: 'A definition provides meaning for a field' },
        { type: 'INHERITS_MEANING_FROM', symbol: '⊲', desc: 'One definition inherits from another' },
        { type: 'REFINES_MEANING_OF', symbol: '⊳', desc: 'Specializes or refines a meaning' },
        { type: 'EQUIVALENT_TO', symbol: '≡', desc: 'Two definitions mean the same thing' },
        { type: 'CONFLICTS_WITH', symbol: '⊗', desc: 'Two definitions have incompatible meanings' }
      ]
    },
    {
      name: 'Dependency Edges',
      color: '#1d9bf0',
      description: 'Relationships about usage and impact',
      edges: [
        { type: 'DEPENDS_ON', symbol: '⟶', desc: 'One entity relies on another' },
        { type: 'DERIVES_FROM', symbol: '⤷', desc: 'Computed or derived from another' },
        { type: 'VALIDATES_AGAINST', symbol: '✓', desc: 'A rule validates data using a definition' },
        { type: 'USES_FIELD', symbol: '⟿', desc: 'An entity uses a specific field' }
      ]
    },
    {
      name: 'Authority Edges',
      color: '#ffad1f',
      description: 'Relationships about governance and ownership',
      edges: [
        { type: 'GOVERNED_BY', symbol: '⊢', desc: 'Subject to governance by a process or actor' },
        { type: 'ASSERTED_BY', symbol: '⊨', desc: 'Claimed or defined by an actor' },
        { type: 'IMPOSED_BY', symbol: '⊫', desc: 'Mandated by an external standard' },
        { type: 'OWNED_BY', symbol: '⊳', desc: 'Stewarded or owned by an actor' }
      ]
    },
    {
      name: 'Temporal Edges',
      color: '#00ba7c',
      description: 'Relationships about change over time',
      edges: [
        { type: 'SUPERSEDES', symbol: '⤳', desc: 'This version replaces an older one' },
        { type: 'VALID_DURING', symbol: '⌛', desc: 'Valid only during a time period' },
        { type: 'VERSION_OF', symbol: '⟳', desc: 'A version of another definition' }
      ]
    }
  ];

  return `
    <div class="ee-edge-categories">
      ${categories.map(cat => `
        <div class="ee-category">
          <div class="ee-category-header" style="border-left: 4px solid ${cat.color}">
            <h4>${cat.name}</h4>
            <p>${cat.description}</p>
          </div>
          <div class="ee-edge-list">
            ${cat.edges.map(edge => `
              <div class="ee-edge-item">
                <span class="ee-edge-symbol" style="color: ${cat.color}">${edge.symbol}</span>
                <div class="ee-edge-info">
                  <span class="ee-edge-type">${formatEdgeType(edge.type)}</span>
                  <span class="ee-edge-desc">${edge.desc}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderEntityPairsTab() {
  const pairs = [
    {
      source: 'Rule',
      target: 'Definition',
      edge: 'DEPENDS_ON',
      meaning: 'This logic depends on this meaning',
      effect: 'The definition becomes operationalized - changes have runtime consequences',
      risk: 'Medium-High',
      riskColor: '#f59e0b'
    },
    {
      source: 'API',
      target: 'Definition',
      edge: 'DEPENDS_ON',
      meaning: 'External system depends on this meaning',
      effect: 'The definition becomes a contract - changes affect external consumers',
      risk: 'High',
      riskColor: '#ef4444'
    },
    {
      source: 'Definition',
      target: 'Definition',
      edge: 'DEPENDS_ON',
      meaning: 'This meaning depends on another meaning',
      effect: 'Creates semantic lineage - upstream changes cascade down',
      risk: 'Medium',
      riskColor: '#f59e0b'
    },
    {
      source: 'Definition',
      target: 'Process',
      edge: 'GOVERNED_BY',
      meaning: 'Meaning is governed by a workflow',
      effect: 'Change is structured and phase-bound',
      risk: 'Low',
      riskColor: '#22c55e'
    },
    {
      source: 'Definition',
      target: 'Actor',
      edge: 'GOVERNED_BY',
      meaning: 'Meaning is governed by human judgment',
      effect: 'Meaning is perspectival - automation is risky',
      risk: 'Medium',
      riskColor: '#f59e0b'
    },
    {
      source: 'Definition',
      target: 'ExternalStandard',
      edge: 'CONFLICTS_WITH',
      meaning: 'Definition conflicts with external standard',
      effect: 'Interoperability break - external consumers may misinterpret',
      risk: 'Critical',
      riskColor: '#dc2626'
    }
  ];

  return `
    <div class="ee-section">
      <p>The same edge type can have different effects depending on what entities it connects:</p>
    </div>

    <div class="ee-pair-table">
      <div class="ee-pair-header">
        <span>Source</span>
        <span>Edge</span>
        <span>Target</span>
        <span>Effect</span>
        <span>Risk</span>
      </div>
      ${pairs.map(pair => `
        <div class="ee-pair-row">
          <span class="ee-pair-entity">${pair.source}</span>
          <span class="ee-pair-edge">--[${formatEdgeType(pair.edge)}]--></span>
          <span class="ee-pair-entity">${pair.target}</span>
          <span class="ee-pair-effect">${pair.effect}</span>
          <span class="ee-pair-risk" style="background: ${pair.riskColor}">${pair.risk}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBehaviorModesTab() {
  const modes = [
    {
      name: 'Stable Anchor',
      code: 'holon',
      color: '#22c55e',
      description: 'A foundational meaning that others depend on. Changes are rare and significant.',
      characteristics: [
        'Stable meaning that resists change',
        'System or external authority',
        'High dependency tolerance',
        'Low temporal flux'
      ],
      susceptibility: {
        'DEPENDS_ON': { effect: 'Strengthening', desc: 'Dependencies are safe and welcomed' },
        'SUPERSEDES': { effect: 'Critical', desc: 'Replacement threatens referential identity' },
        'CONFLICTS_WITH': { effect: 'Catastrophic', desc: 'Conflicts undermine foundation' }
      }
    },
    {
      name: 'Meaning Bridge',
      code: 'protogon',
      color: '#f59e0b',
      description: 'Mediates between stable and dynamic meanings. Valid within structured phases.',
      characteristics: [
        'Contextual stability',
        'Process-bound authority',
        'Moderate dependencies',
        'Structured change expected'
      ],
      susceptibility: {
        'DEPENDS_ON': { effect: 'Normal', desc: 'Dependencies are phase-bound' },
        'SUPERSEDES': { effect: 'Expected', desc: 'Clean phase transition' },
        'CONFLICTS_WITH': { effect: 'Review', desc: 'Signals process mismatch' }
      }
    },
    {
      name: 'Emergent Meaning',
      code: 'emanon',
      color: '#ef4444',
      description: 'Highly contextual and perspective-dependent. Interpretation varies.',
      characteristics: [
        'Interpretive stability',
        'Human/perspectival authority',
        'Low dependency tolerance',
        'High temporal flux'
      ],
      susceptibility: {
        'DEPENDS_ON': { effect: 'Dangerous', desc: 'Building on sand - fragile' },
        'SUPERSEDES': { effect: 'Natural', desc: 'Change is expected' },
        'CONFLICTS_WITH': { effect: 'Expected', desc: 'Perspectives differ' }
      }
    }
  ];

  return `
    <div class="ee-section">
      <div class="ee-key-insight">
        <div class="ee-insight-icon">🎯</div>
        <div class="ee-insight-text">
          <strong>Behavior modes are inferred, not assigned</strong>
          <p>The system observes how a definition is used and what properties it has, then infers how it's "behaving". This can change over time.</p>
        </div>
      </div>
    </div>

    <div class="ee-behavior-modes">
      ${modes.map(mode => `
        <div class="ee-mode-card" style="border-top: 4px solid ${mode.color}">
          <div class="ee-mode-header">
            <h4>${mode.name}</h4>
            <span class="ee-mode-code" style="background: ${mode.color}">${mode.code}</span>
          </div>
          <p class="ee-mode-desc">${mode.description}</p>

          <div class="ee-mode-chars">
            <strong>Characteristics:</strong>
            <ul>
              ${mode.characteristics.map(c => `<li>${c}</li>`).join('')}
            </ul>
          </div>

          <div class="ee-mode-suscept">
            <strong>How edges affect this mode:</strong>
            <div class="ee-suscept-table">
              ${Object.entries(mode.susceptibility).map(([edge, sus]) => `
                <div class="ee-suscept-row">
                  <span class="ee-suscept-edge">${formatEdgeType(edge)}</span>
                  <span class="ee-suscept-effect">${sus.effect}</span>
                  <span class="ee-suscept-desc">${sus.desc}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatEdgeType(type) {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================================================
// STYLES
// ============================================================================

const edgeExplainerStyles = `
  .edge-explainer-panel {
    background: var(--panel-bg, #0d1117);
    border-radius: 12px;
    padding: 24px;
    max-width: 900px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .ee-header {
    margin-bottom: 24px;
  }

  .ee-header h2 {
    margin: 0 0 8px 0;
    color: var(--text-primary, #e6edf3);
    font-size: 24px;
  }

  .ee-subtitle {
    margin: 0;
    color: var(--text-secondary, #8b949e);
    font-size: 14px;
  }

  .ee-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color, #30363d);
    padding-bottom: 12px;
  }

  .ee-tab {
    background: transparent;
    border: none;
    padding: 8px 16px;
    color: var(--text-secondary, #8b949e);
    cursor: pointer;
    border-radius: 6px;
    font-size: 14px;
    transition: all 0.2s;
  }

  .ee-tab:hover {
    background: var(--hover-bg, rgba(255,255,255,0.05));
    color: var(--text-primary, #e6edf3);
  }

  .ee-tab.active {
    background: var(--accent-bg, rgba(120,86,255,0.2));
    color: var(--accent-color, #7856ff);
  }

  .ee-tab-content {
    display: none;
  }

  .ee-tab-content.active {
    display: block;
  }

  .ee-section {
    margin-bottom: 24px;
  }

  .ee-section h3 {
    color: var(--text-primary, #e6edf3);
    margin: 0 0 12px 0;
    font-size: 18px;
  }

  .ee-principle-box {
    background: var(--card-bg, #161b22);
    border-radius: 8px;
    padding: 16px 20px;
    border-left: 4px solid var(--accent-color, #7856ff);
  }

  .ee-principle-box p {
    margin: 0;
    padding: 4px 0;
    color: var(--text-primary, #e6edf3);
  }

  .ee-key-insight {
    display: flex;
    gap: 16px;
    background: var(--info-bg, rgba(29,155,240,0.1));
    border: 1px solid var(--info-border, rgba(29,155,240,0.3));
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
  }

  .ee-insight-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .ee-insight-text strong {
    color: var(--text-primary, #e6edf3);
    display: block;
    margin-bottom: 4px;
  }

  .ee-insight-text p {
    margin: 0;
    color: var(--text-secondary, #8b949e);
    font-size: 14px;
  }

  .ee-formula {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: var(--card-bg, #161b22);
    border-radius: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .ee-formula-item {
    text-align: center;
    padding: 12px 20px;
    background: var(--panel-bg, #0d1117);
    border-radius: 8px;
  }

  .ee-formula-label {
    display: block;
    font-weight: 600;
    color: var(--text-primary, #e6edf3);
    margin-bottom: 4px;
  }

  .ee-formula-desc {
    display: block;
    font-size: 12px;
    color: var(--text-secondary, #8b949e);
  }

  .ee-formula-op {
    font-size: 24px;
    color: var(--accent-color, #7856ff);
    font-weight: 600;
  }

  .ee-benefits {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .ee-benefits li {
    padding: 8px 0;
    color: var(--text-secondary, #8b949e);
    border-bottom: 1px solid var(--border-color, #30363d);
  }

  .ee-benefits li:last-child {
    border-bottom: none;
  }

  .ee-benefits strong {
    color: var(--text-primary, #e6edf3);
  }

  /* Edge Types Tab */
  .ee-edge-categories {
    display: grid;
    gap: 20px;
  }

  .ee-category {
    background: var(--card-bg, #161b22);
    border-radius: 8px;
    overflow: hidden;
  }

  .ee-category-header {
    padding: 16px 20px;
    background: var(--panel-bg, #0d1117);
  }

  .ee-category-header h4 {
    margin: 0 0 4px 0;
    color: var(--text-primary, #e6edf3);
  }

  .ee-category-header p {
    margin: 0;
    color: var(--text-secondary, #8b949e);
    font-size: 14px;
  }

  .ee-edge-list {
    padding: 8px;
  }

  .ee-edge-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 6px;
    transition: background 0.2s;
  }

  .ee-edge-item:hover {
    background: var(--hover-bg, rgba(255,255,255,0.05));
  }

  .ee-edge-symbol {
    font-size: 20px;
    width: 32px;
    text-align: center;
  }

  .ee-edge-info {
    flex: 1;
  }

  .ee-edge-type {
    display: block;
    font-weight: 500;
    color: var(--text-primary, #e6edf3);
    font-size: 14px;
  }

  .ee-edge-desc {
    display: block;
    color: var(--text-secondary, #8b949e);
    font-size: 13px;
  }

  /* Entity Pairs Tab */
  .ee-pair-table {
    background: var(--card-bg, #161b22);
    border-radius: 8px;
    overflow: hidden;
  }

  .ee-pair-header {
    display: grid;
    grid-template-columns: 100px 180px 120px 1fr 80px;
    padding: 12px 16px;
    background: var(--panel-bg, #0d1117);
    font-weight: 600;
    color: var(--text-secondary, #8b949e);
    font-size: 12px;
    text-transform: uppercase;
    gap: 8px;
  }

  .ee-pair-row {
    display: grid;
    grid-template-columns: 100px 180px 120px 1fr 80px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #30363d);
    align-items: center;
    gap: 8px;
  }

  .ee-pair-entity {
    color: var(--text-primary, #e6edf3);
    font-weight: 500;
  }

  .ee-pair-edge {
    color: var(--accent-color, #7856ff);
    font-size: 12px;
    font-family: monospace;
  }

  .ee-pair-effect {
    color: var(--text-secondary, #8b949e);
    font-size: 13px;
  }

  .ee-pair-risk {
    padding: 4px 8px;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
  }

  /* Behavior Modes Tab */
  .ee-behavior-modes {
    display: grid;
    gap: 20px;
  }

  .ee-mode-card {
    background: var(--card-bg, #161b22);
    border-radius: 8px;
    padding: 20px;
  }

  .ee-mode-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .ee-mode-header h4 {
    margin: 0;
    color: var(--text-primary, #e6edf3);
  }

  .ee-mode-code {
    padding: 4px 12px;
    border-radius: 20px;
    color: white;
    font-size: 12px;
    font-weight: 600;
  }

  .ee-mode-desc {
    color: var(--text-secondary, #8b949e);
    margin: 0 0 16px 0;
  }

  .ee-mode-chars {
    margin-bottom: 16px;
  }

  .ee-mode-chars strong {
    color: var(--text-secondary, #8b949e);
    font-size: 12px;
    text-transform: uppercase;
  }

  .ee-mode-chars ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
    color: var(--text-primary, #e6edf3);
  }

  .ee-mode-chars li {
    padding: 2px 0;
  }

  .ee-mode-suscept strong {
    color: var(--text-secondary, #8b949e);
    font-size: 12px;
    text-transform: uppercase;
    display: block;
    margin-bottom: 8px;
  }

  .ee-suscept-table {
    background: var(--panel-bg, #0d1117);
    border-radius: 6px;
    overflow: hidden;
  }

  .ee-suscept-row {
    display: grid;
    grid-template-columns: 140px 100px 1fr;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-color, #30363d);
    align-items: center;
    gap: 12px;
  }

  .ee-suscept-row:last-child {
    border-bottom: none;
  }

  .ee-suscept-edge {
    color: var(--text-primary, #e6edf3);
    font-size: 13px;
  }

  .ee-suscept-effect {
    font-weight: 600;
    font-size: 12px;
  }

  .ee-suscept-desc {
    color: var(--text-secondary, #8b949e);
    font-size: 13px;
  }
`;

// ============================================================================
// INLINE EDGE EXPLANATION
// ============================================================================

/**
 * Generate a tooltip/inline explanation for a specific edge
 */
function explainEdgeInline(edge, targetEORole = 'mixed') {
  const { type, sourceType, targetType } = edge;

  // Get base meaning
  let meaning = `${sourceType} --[${formatEdgeType(type)}]--> ${targetType}`;

  // Add role-specific interpretation
  const susceptibilityHints = {
    DEPENDS_ON: {
      holon: 'Target is a stable anchor - dependency is safe',
      protogon: 'Target is phase-bound - dependency is structured',
      emanon: 'Target is emergent - dependency is fragile'
    },
    SUPERSEDES: {
      holon: 'Replacing stable meaning - high impact!',
      protogon: 'Normal phase transition',
      emanon: 'Natural evolution'
    },
    CONFLICTS_WITH: {
      holon: 'Critical - foundation conflict',
      protogon: 'Review needed - process mismatch',
      emanon: 'Expected - perspectives differ'
    }
  };

  let hint = '';
  if (susceptibilityHints[type] && susceptibilityHints[type][targetEORole]) {
    hint = susceptibilityHints[type][targetEORole];
  }

  return {
    title: meaning,
    hint,
    fullExplanation: hint ? `${meaning}\n${hint}` : meaning
  };
}

/**
 * Render a small badge for an edge type
 */
function renderEdgeBadge(edgeType, options = {}) {
  const symbols = {
    DEFINES_MEANING_OF: '→',
    INHERITS_MEANING_FROM: '⊲',
    REFINES_MEANING_OF: '⊳',
    EQUIVALENT_TO: '≡',
    CONFLICTS_WITH: '⊗',
    DEPENDS_ON: '⟶',
    DERIVES_FROM: '⤷',
    VALIDATES_AGAINST: '✓',
    USES_FIELD: '⟿',
    GOVERNED_BY: '⊢',
    ASSERTED_BY: '⊨',
    IMPOSED_BY: '⊫',
    OWNED_BY: '⊳',
    SUPERSEDES: '⤳',
    VALID_DURING: '⌛',
    VERSION_OF: '⟳'
  };

  const colors = {
    DEFINES_MEANING_OF: '#7856ff',
    INHERITS_MEANING_FROM: '#7856ff',
    REFINES_MEANING_OF: '#7856ff',
    EQUIVALENT_TO: '#7856ff',
    CONFLICTS_WITH: '#ef4444',
    DEPENDS_ON: '#1d9bf0',
    DERIVES_FROM: '#1d9bf0',
    VALIDATES_AGAINST: '#1d9bf0',
    USES_FIELD: '#1d9bf0',
    GOVERNED_BY: '#ffad1f',
    ASSERTED_BY: '#ffad1f',
    IMPOSED_BY: '#ffad1f',
    OWNED_BY: '#ffad1f',
    SUPERSEDES: '#00ba7c',
    VALID_DURING: '#00ba7c',
    VERSION_OF: '#00ba7c'
  };

  const symbol = symbols[edgeType] || '?';
  const color = colors[edgeType] || '#8b949e';
  const showLabel = options.showLabel !== false;

  return `
    <span class="edge-badge" style="
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: ${color}20;
      border: 1px solid ${color}40;
      border-radius: 4px;
      font-size: 12px;
      color: ${color};
    ">
      <span style="font-size: 14px;">${symbol}</span>
      ${showLabel ? `<span>${formatEdgeType(edgeType)}</span>` : ''}
    </span>
  `;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createEdgeExplainerPanel,
    explainEdgeInline,
    renderEdgeBadge,
    formatEdgeType
  };
}

if (typeof window !== 'undefined') {
  window.EOEdgeExplainer = {
    createPanel: createEdgeExplainerPanel,
    explainEdge: explainEdgeInline,
    renderBadge: renderEdgeBadge,
    formatType: formatEdgeType
  };
}
