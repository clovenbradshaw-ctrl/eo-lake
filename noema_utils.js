/**
 * noema Shared Utilities
 * Consolidated utility functions to avoid code duplication across modules.
 */

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID with optional prefix
 * @param {string} prefix - Optional prefix (default: 'id')
 * @returns {string} Unique identifier
 */
function generateId(prefix = 'id') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Escape HTML entities to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format timestamp as human-readable relative time
 * @param {number|string|Date} timestamp - Timestamp to format
 * @returns {string} Human-readable time string
 */
function formatTimeAgo(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

  return date.toLocaleDateString();
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Human-readable size string
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// ============================================================================
// Field Type Utilities
// ============================================================================

/**
 * Get icon class for field type
 * @param {string} type - Field type
 * @returns {string} Phosphor icon class
 */
function getFieldTypeIcon(type) {
  const icons = {
    text: 'ph ph-text-aa',
    longText: 'ph ph-text-align-left',
    number: 'ph ph-hash',
    select: 'ph ph-list-bullets',
    multiSelect: 'ph ph-list-checks',
    date: 'ph ph-calendar',
    checkbox: 'ph ph-check-square',
    email: 'ph ph-envelope',
    url: 'ph ph-globe',
    phone: 'ph ph-phone',
    currency: 'ph ph-currency-dollar',
    percent: 'ph ph-percent',
    duration: 'ph ph-timer',
    rating: 'ph ph-star',
    link: 'ph ph-link',
    attachment: 'ph ph-paperclip',
    lookup: 'ph ph-magnifying-glass',
    formula: 'ph ph-function',
    rollup: 'ph ph-chart-bar',
    count: 'ph ph-list-numbers',
    autonumber: 'ph ph-hash-straight',
    barcode: 'ph ph-barcode',
    button: 'ph ph-cursor-click'
  };
  return icons[type] || 'ph ph-text-aa';
}

/**
 * Get display name for field type
 * @param {string} type - Field type
 * @returns {string} Human-readable type name
 */
function getFieldTypeName(type) {
  const names = {
    text: 'Text',
    longText: 'Long Text',
    number: 'Number',
    select: 'Select',
    multiSelect: 'Multi Select',
    date: 'Date',
    checkbox: 'Checkbox',
    email: 'Email',
    url: 'URL',
    phone: 'Phone',
    currency: 'Currency',
    percent: 'Percent',
    duration: 'Duration',
    rating: 'Rating',
    link: 'Link',
    attachment: 'Attachment',
    lookup: 'Lookup',
    formula: 'Formula',
    rollup: 'Rollup',
    count: 'Count',
    autonumber: 'Autonumber',
    barcode: 'Barcode',
    button: 'Button'
  };
  return names[type] || 'Text';
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    escapeHtml,
    formatTimeAgo,
    formatFileSize,
    getFieldTypeIcon,
    getFieldTypeName
  };
}

if (typeof window !== 'undefined') {
  window.EOUtils = {
    generateId,
    escapeHtml,
    formatTimeAgo,
    formatFileSize,
    getFieldTypeIcon,
    getFieldTypeName
  };
}
