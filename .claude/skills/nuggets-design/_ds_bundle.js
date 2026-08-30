/* @ds-bundle: {"format":4,"namespace":"NuggetsDesignSystem_33854b","components":[{"name":"NuggetMark","sourcePath":"components/brand/NuggetMark.jsx"},{"name":"Wordmark","sourcePath":"components/brand/Wordmark.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SearchField","sourcePath":"components/forms/SearchField.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"},{"name":"IdeaCard","sourcePath":"components/nuggets/IdeaCard.jsx"},{"name":"IdeaForm","sourcePath":"components/nuggets/IdeaForm.jsx"},{"name":"IdeaList","sourcePath":"components/nuggets/IdeaList.jsx"},{"name":"RandomNugget","sourcePath":"components/nuggets/RandomNugget.jsx"},{"name":"TagCombobox","sourcePath":"components/nuggets/TagCombobox.jsx"},{"name":"TagFilter","sourcePath":"components/nuggets/TagFilter.jsx"},{"name":"TrashView","sourcePath":"components/nuggets/TrashView.jsx"}],"sourceHashes":{"components/brand/NuggetMark.jsx":"db5977012dc1","components/brand/Wordmark.jsx":"1cf439ce8076","components/core/Badge.jsx":"6fd78be5ed2a","components/core/Button.jsx":"712ad0bea87e","components/core/Card.jsx":"ad4e36e06eea","components/core/IconButton.jsx":"7b3f3b10e08b","components/core/Tag.jsx":"ba9e090d1d1a","components/feedback/Dialog.jsx":"455fb020ea0a","components/feedback/EmptyState.jsx":"77f41ad4d43d","components/forms/Input.jsx":"5bc6eedc6cfc","components/forms/SearchField.jsx":"90a5ddf7d2b9","components/forms/Textarea.jsx":"daadfccdaa30","components/navigation/TopBar.jsx":"1d093c4485cf","components/nuggets/IdeaCard.jsx":"8275923d6b5d","components/nuggets/IdeaForm.jsx":"abbd62d3be20","components/nuggets/IdeaList.jsx":"3e1743b9e38d","components/nuggets/RandomNugget.jsx":"2f9a5b7189da","components/nuggets/TagCombobox.jsx":"d14907e900be","components/nuggets/TagFilter.jsx":"ec9949643d96","components/nuggets/TrashView.jsx":"f68148b6fb08","prototype/browser-window.jsx":"ffeb1267e10b","prototype/ios-frame.jsx":"24642b887be3","ui_kits/marketing_site/Landing.jsx":"78a15d028dbe","ui_kits/mobile_app/PhoneApp.jsx":"737cbdee1524","ui_kits/web_app/BankApp.jsx":"c4d535d7d015","ui_kits/web_app/data.js":"a32e2c39b875"},"inlinedExternals":[],"unexposedExports":[{"name":"dipFor","sourcePath":"components/core/Tag.jsx"},{"name":"fluidRadius","sourcePath":"components/nuggets/IdeaCard.jsx"}]} */

(() => {

const __ds_ns = (window.NuggetsDesignSystem_33854b = window.NuggetsDesignSystem_33854b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/NuggetMark.jsx
try { (() => {
/** Renders the nugget blob illustration shipped in assets/. */
function NuggetMark({
  size = 40,
  variant = 'single',
  bitten = false,
  style
}) {
  const files = {
    single: 'nugget.svg',
    alt: 'nugget-alt.svg',
    trio: 'nugget-trio.svg',
    bucket: 'bucket.svg',
    dip: 'dip-cup.svg'
  };
  const bites = {
    single: 'nugget-bitten.svg',
    trio: 'nugget-trio-bitten.svg'
  };
  const src = bitten && bites[variant] || files[variant] || 'nugget.svg';
  const ratio = {
    single: 100 / 120,
    alt: 100 / 120,
    trio: 120 / 260,
    bucket: 130 / 140,
    dip: 80 / 100
  }[variant] || 1;
  return /*#__PURE__*/React.createElement("img", {
    src: `${typeof window !== 'undefined' && window.NUG_ASSET_BASE || 'assets/'}${src}`,
    alt: "",
    "aria-hidden": "true",
    style: {
      width: size,
      height: size * ratio,
      display: 'block',
      ...style
    }
  });
}
Object.assign(__ds_scope, { NuggetMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/NuggetMark.jsx", error: String((e && e.message) || e) }); }

// components/brand/Wordmark.jsx
try { (() => {
function Wordmark({
  size = 24,
  tone = 'ink',
  withMark = true,
  iconOnly = false,
  style
}) {
  const colors = {
    ink: 'var(--nug-ink-900)',
    cream: 'var(--nug-cream-50)',
    golden: 'var(--nug-golden-500)'
  };
  if (iconOnly) {
    return /*#__PURE__*/React.createElement("img", {
      src: `${typeof window !== 'undefined' && window.NUG_ASSET_BASE || 'assets/'}nugget.svg`,
      alt: "Nuggets",
      style: {
        width: size,
        height: size * 0.83,
        display: 'block',
        ...style
      }
    });
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: size * 0.3,
      ...style
    }
  }, withMark && /*#__PURE__*/React.createElement("img", {
    src: `${typeof window !== 'undefined' && window.NUG_ASSET_BASE || 'assets/'}nugget.svg`,
    alt: "",
    "aria-hidden": "true",
    style: {
      width: size * 1.15,
      height: size * 0.96,
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-black)',
      fontSize: size,
      letterSpacing: '-0.03em',
      lineHeight: 1,
      color: colors[tone] || colors.ink
    }
  }, "nuggets"));
}
Object.assign(__ds_scope, { Wordmark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Wordmark.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const nugBadgeTones = {
  neutral: {
    bg: 'var(--nug-cream-200)',
    fg: 'var(--nug-ink-700)'
  },
  golden: {
    bg: 'var(--nug-golden-200)',
    fg: 'var(--nug-golden-700)'
  },
  ketchup: {
    bg: 'var(--nug-ketchup-100)',
    fg: 'var(--nug-ketchup-600)'
  },
  herb: {
    bg: '#DCEFE1',
    fg: '#2C6E42'
  },
  ink: {
    bg: 'var(--nug-ink-900)',
    fg: 'var(--nug-cream-50)'
  }
};
function Badge({
  tone = 'neutral',
  children,
  style
}) {
  const t = nugBadgeTones[tone] || nugBadgeTones.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: 22,
      padding: '0 9px',
      background: t.bg,
      color: t.fg,
      borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-micro)',
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const nugBtnSizes = {
  sm: {
    padding: '0 14px',
    height: 34,
    fontSize: 'var(--text-body-sm)',
    gap: 6
  },
  md: {
    padding: '0 20px',
    height: 42,
    fontSize: 'var(--text-body-md)',
    gap: 8
  },
  lg: {
    padding: '0 28px',
    height: 52,
    fontSize: 'var(--text-body-lg)',
    gap: 10
  }
};
const nugBtnVariants = {
  primary: {
    bg: 'var(--nug-golden-400)',
    bgHover: 'var(--nug-golden-500)',
    fg: 'var(--nug-ink-900)',
    border: 'transparent',
    edge: 'var(--nug-golden-600)'
  },
  danger: {
    bg: 'var(--nug-ketchup-500)',
    bgHover: 'var(--nug-ketchup-600)',
    fg: 'var(--nug-cream-50)',
    border: 'transparent',
    edge: 'var(--nug-ketchup-600)'
  },
  secondary: {
    bg: 'var(--nug-cream-50)',
    bgHover: 'var(--nug-cream-200)',
    fg: 'var(--nug-ink-900)',
    border: 'var(--nug-ink-900)',
    edge: 'var(--nug-ink-900)'
  },
  ghost: {
    bg: 'transparent',
    bgHover: 'var(--nug-cream-200)',
    fg: 'var(--nug-ink-700)',
    border: 'transparent',
    edge: null
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  iconLeft,
  iconRight,
  onClick,
  type = 'button',
  children,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const s = nugBtnSizes[size] || nugBtnSizes.md;
  const v = nugBtnVariants[variant] || nugBtnVariants.primary;
  const lift = v.edge && !disabled;
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      height: s.height,
      padding: s.padding,
      width: fullWidth ? '100%' : undefined,
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      fontSize: s.fontSize,
      letterSpacing: '0.005em',
      color: v.fg,
      background: hover && !disabled ? v.bgHover : v.bg,
      border: `var(--border-regular) solid ${v.border}`,
      borderRadius: 'var(--radius-pill)',
      boxShadow: lift ? press ? `0 1px 0 ${v.edge}` : `0 3px 0 ${v.edge}` : 'none',
      transform: lift && press ? 'translateY(2px)' : 'translateY(0)',
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
      whiteSpace: 'nowrap',
      ...style
    }
  }, iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  tone = 'plain',
  padding = 20,
  interactive = false,
  onClick,
  children,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const tones = {
    plain: {
      bg: 'var(--surface-card)',
      border: 'var(--nug-ink-200)'
    },
    cream: {
      bg: 'var(--nug-cream-50)',
      border: 'var(--nug-ink-200)'
    },
    sunken: {
      bg: 'var(--nug-cream-200)',
      border: 'transparent'
    },
    ink: {
      bg: 'var(--nug-ink-900)',
      border: 'transparent'
    }
  };
  const t = tones[tone] || tones.plain;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: t.bg,
      color: tone === 'ink' ? 'var(--nug-cream-50)' : 'var(--text-body)',
      border: `var(--border-regular) solid ${t.border}`,
      borderRadius: 'var(--radius-lg)',
      padding,
      boxShadow: interactive && hover ? 'var(--shadow-2)' : 'var(--shadow-1)',
      transform: interactive && hover ? 'translateY(-2px)' : 'none',
      cursor: interactive ? 'pointer' : 'default',
      transition: 'transform var(--dur-base) var(--ease-bounce), box-shadow var(--dur-base) var(--ease-out)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
const nugIconBtnSizes = {
  sm: 30,
  md: 38,
  lg: 46
};
function IconButton({
  size = 'md',
  variant = 'ghost',
  label,
  disabled = false,
  onClick,
  children,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const d = nugIconBtnSizes[size] || nugIconBtnSizes.md;
  const filled = variant === 'filled';
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: d,
      height: d,
      padding: 0,
      borderRadius: 'var(--radius-pill)',
      border: variant === 'outline' ? 'var(--border-regular) solid var(--nug-ink-900)' : 'none',
      background: filled ? hover ? 'var(--nug-golden-500)' : 'var(--nug-golden-400)' : hover ? 'var(--nug-cream-200)' : 'transparent',
      color: filled ? 'var(--nug-ink-900)' : 'var(--nug-ink-700)',
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--dur-fast) var(--ease-out)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
const nugDips = {
  mustard: '#F2C230',
  bbq: '#8B4A2B',
  chilli: '#E8536A',
  herb: '#3F9C5D',
  curry: '#D98324',
  ranch: '#7C8CDE'
};
const nugDipOrder = ['chilli', 'herb', 'mustard', 'ranch', 'bbq', 'curry'];
// FNV-1a with a final xor-fold. A weaker hash (multiply-31 into a modulus that is
// 1 mod 6) collapses short lowercase tag names onto only two indices.
function dipFor(name = '') {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 15;
  return nugDipOrder[(h >>> 0) % nugDipOrder.length];
}
function Tag({
  name,
  dip,
  count,
  active = false,
  onClick,
  onRemove,
  children,
  style
}) {
  const label = name != null ? name : children;
  const c = nugDips[dip || dipFor(String(label))];
  const clickable = !!onClick;
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 26,
      padding: onRemove ? '0 6px 0 10px' : '0 11px',
      borderRadius: 'var(--radius-pill)',
      background: active ? c : 'var(--nug-cream-50)',
      border: `var(--border-hairline) solid ${active ? c : 'var(--nug-ink-200)'}`,
      color: active ? 'var(--nug-white)' : 'var(--nug-ink-700)',
      fontSize: 'var(--text-body-sm)',
      fontWeight: 'var(--weight-semibold)',
      cursor: clickable ? 'pointer' : 'default',
      userSelect: 'none',
      transition: 'all var(--dur-fast) var(--ease-out)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 'var(--radius-nugget)',
      background: active ? 'var(--nug-white)' : c,
      flex: 'none'
    }
  }), label, count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      opacity: .7
    }
  }, count), onRemove && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: e => {
      e.stopPropagation();
      onRemove();
    },
    "aria-label": `Remove ${label}`,
    style: {
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      fontSize: 14,
      lineHeight: 1,
      padding: '0 3px'
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { dipFor, Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open = false,
  title,
  description,
  onClose,
  footer,
  width = 460,
  children
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(42,28,18,.44)',
      backdropFilter: 'blur(3px)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: '100%',
      maxWidth: width,
      padding: 24,
      background: 'var(--surface-card)',
      border: 'var(--border-chunky) solid var(--nug-ink-900)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-3)',
      animation: 'none',
      transform: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: description ? 6 : 16
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      flex: 1,
      fontSize: 'var(--text-title-2)',
      fontWeight: 'var(--weight-bold)'
    }
  }, title), onClose && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    label: "Close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.6",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6 6 18"
  })))), description && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 18px',
      fontSize: 'var(--text-body-md)',
      color: 'var(--nug-ink-700)',
      textWrap: 'pretty'
    }
  }, description), children, footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 22
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  headline,
  body,
  action,
  variant = 'single',
  style
}) {
  const src = {
    single: 'nugget.svg',
    trio: 'nugget-trio.svg',
    bucket: 'bucket.svg',
    dip: 'dip-cup.svg'
  }[variant] || 'nugget.svg';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 12,
      padding: '48px 24px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: `${typeof window !== 'undefined' && window.NUG_ASSET_BASE || 'assets/'}${src}`,
    alt: "",
    "aria-hidden": "true",
    style: {
      width: variant === 'trio' ? 180 : 92,
      opacity: .9,
      marginBottom: 4
    }
  }), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-title-2)',
      fontWeight: 'var(--weight-bold)'
    }
  }, headline), body && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: 340,
      fontSize: 'var(--text-body-md)',
      color: 'var(--nug-ink-500)',
      textWrap: 'pretty'
    }
  }, body), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  hint,
  error,
  disabled = false,
  iconLeft,
  id,
  style
}) {
  const [focus, setFocus] = React.useState(false);
  const fid = id || `nug-in-${label ? label.replace(/\s+/g, '-').toLowerCase() : 'field'}`;
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fid,
    style: {
      display: 'block',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginBottom: 6,
      fontSize: 'var(--text-label)',
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase',
      color: 'var(--nug-ink-500)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 44,
      padding: '0 14px',
      background: disabled ? 'var(--nug-cream-200)' : 'var(--nug-white)',
      border: `var(--border-regular) solid ${error ? 'var(--nug-ketchup-500)' : focus ? 'var(--nug-golden-500)' : 'var(--nug-ink-200)'}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focus ? 'var(--focus-shadow)' : 'none',
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
    }
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--nug-ink-300)',
      display: 'flex'
    }
  }, iconLeft), /*#__PURE__*/React.createElement("input", {
    id: fid,
    type: type,
    value: value,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      font: 'inherit',
      fontSize: 'var(--text-body-md)',
      color: 'var(--text-body)'
    }
  })), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 5,
      fontSize: 'var(--text-body-sm)',
      color: error ? 'var(--nug-ketchup-600)' : 'var(--nug-ink-500)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchField.jsx
try { (() => {
function SearchField({
  placeholder = 'Search your nuggets…',
  value,
  onChange,
  onClear,
  style
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      height: 40,
      padding: '0 8px 0 14px',
      background: focus ? 'var(--nug-white)' : 'var(--nug-cream-200)',
      border: `var(--border-regular) solid ${focus ? 'var(--nug-golden-500)' : 'transparent'}`,
      borderRadius: 'var(--radius-pill)',
      boxShadow: focus ? 'var(--focus-shadow)' : 'none',
      transition: 'all var(--dur-fast) var(--ease-out)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--nug-ink-500)",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m20 20-3.5-3.5"
  })), /*#__PURE__*/React.createElement("input", {
    value: value,
    placeholder: placeholder,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      font: 'inherit',
      fontSize: 'var(--text-body-md)',
      color: 'var(--text-body)'
    }
  }), value && onClear && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClear,
    "aria-label": "Clear search",
    style: {
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: 'var(--nug-ink-500)',
      fontSize: 16,
      lineHeight: 1,
      padding: '4px 8px'
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function Textarea({
  label,
  placeholder,
  value,
  onChange,
  rows = 4,
  hint,
  disabled = false,
  id,
  style
}) {
  const [focus, setFocus] = React.useState(false);
  const fid = id || 'nug-ta';
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fid,
    style: {
      display: 'block',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginBottom: 6,
      fontSize: 'var(--text-label)',
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase',
      color: 'var(--nug-ink-500)'
    }
  }, label), /*#__PURE__*/React.createElement("textarea", {
    id: fid,
    rows: rows,
    value: value,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      display: 'block',
      width: '100%',
      padding: '12px 14px',
      resize: 'vertical',
      font: 'inherit',
      fontSize: 'var(--text-body-md)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--text-body)',
      background: disabled ? 'var(--nug-cream-200)' : 'var(--nug-white)',
      border: `var(--border-regular) solid ${focus ? 'var(--nug-golden-500)' : 'var(--nug-ink-200)'}`,
      borderRadius: 'var(--radius-md)',
      outline: 'none',
      boxShadow: focus ? 'var(--focus-shadow)' : 'none',
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
    }
  }), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 5,
      fontSize: 'var(--text-body-sm)',
      color: 'var(--nug-ink-500)'
    }
  }, hint));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
function TopBar({
  center,
  right,
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      height: 'var(--topbar-h)',
      padding: '0 var(--gutter-web)',
      background: 'var(--nug-cream-50)',
      borderBottom: 'var(--border-hairline) solid var(--nug-ink-200)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Wordmark, {
    size: 22
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'center'
    }
  }, center), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, right));
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// components/nuggets/IdeaCard.jsx
try { (() => {
function truncate(s = '', max = 40) {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/** Keeps at most `count` sentences, then tapers into trailing dots instead of a hard cut. */
function clampSentences(s = '', count = 2) {
  const parts = s.match(/[^.!?]+[.!?]*/g) || [s];
  if (parts.length <= count) return s;
  return parts.slice(0, count).join('').trimEnd().replace(/[.!?]*$/, '') + '…';
}

// FNV-1a, same mixer as dipFor — a weak hash clusters the corners and the
// variance disappears.
function nugHash(s = '') {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Eight corner values in [min,max] — a soft rounded rect that is never quite the
 *  same twice, the way no two nuggets are the same shape. */
function fluidRadius(seed = '', min = 10, max = 28) {
  let h = nugHash(seed);
  const v = [];
  for (let i = 0; i < 8; i++) {
    h = Math.imul(h ^ i + 1, 0x01000193) >>> 0;
    v.push(min + (h >>> 9) % (max - min + 1));
  }
  return `${v[0]}px ${v[1]}px ${v[2]}px ${v[3]}px / ${v[4]}px ${v[5]}px ${v[6]}px ${v[7]}px`;
}
function Bite({
  background,
  border
}) {
  // A single round chomp taken clean out of the top-right corner, plus two
  // crumbs that fell off — reads as a bite, not an edge scallop.
  return /*#__PURE__*/React.createElement("svg", {
    width: "76",
    height: "76",
    viewBox: "-12 -12 76 76",
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: -12,
      right: -12,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "52",
    cy: "0",
    r: "28",
    fill: background
  }), /*#__PURE__*/React.createElement("path", {
    d: "M24,0 A28,28 0 0,1 52,28",
    fill: "none",
    stroke: border,
    strokeWidth: "2",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "64",
    cy: "24",
    r: "3.2",
    fill: border,
    opacity: "0.55"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "36",
    cy: "-12",
    r: "2.2",
    fill: border,
    opacity: "0.45"
  }));
}
function IdeaCard({
  title,
  notes,
  tags = [],
  date,
  archived = false,
  shape = 'fluid',
  bitten = false,
  biteBackground = 'var(--surface-page)',
  seed,
  onClick,
  actions,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const radius = shape === 'fluid' ? fluidRadius(seed || title || '') : 'var(--radius-lg)';
  return /*#__PURE__*/React.createElement("article", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: '16px 18px',
      background: archived ? 'var(--nug-cream-50)' : 'var(--surface-card)',
      border: 'var(--border-regular) solid var(--nug-ink-200)',
      borderRadius: radius,
      boxShadow: hover && onClick ? 'var(--shadow-2)' : 'var(--shadow-1)',
      transform: hover && onClick ? 'translateY(-2px) rotate(-0.25deg)' : 'none',
      transition: 'transform var(--dur-base) var(--ease-bounce), box-shadow var(--dur-base) var(--ease-out)',
      cursor: onClick ? 'pointer' : 'default',
      opacity: archived ? 0.85 : 1,
      ...style
    }
  }, bitten && /*#__PURE__*/React.createElement(Bite, {
    background: biteBackground,
    border: "var(--nug-ink-200)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      width: '100%',
      fontSize: 'var(--text-title-3)',
      fontWeight: 'var(--weight-bold)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, truncate(title, 40)), notes && /*#__PURE__*/React.createElement("p", {
    style: {
      width: '100%',
      margin: 0,
      fontSize: 'var(--text-body-sm)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--nug-ink-700)',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden'
    }
  }, clampSentences(notes, 2)), tags.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'nowrap',
      overflowX: 'auto',
      gap: 6,
      marginTop: 1,
      paddingBottom: 2,
      scrollbarWidth: 'none'
    }
  }, tags.map(t => /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: t,
    name: t
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 'auto',
      paddingTop: 2
    }
  }, date && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--nug-ink-500)',
      whiteSpace: 'nowrap'
    }
  }, date), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginLeft: 'auto'
    }
  }, actions)));
}
Object.assign(__ds_scope, { fluidRadius, IdeaCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nuggets/IdeaCard.jsx", error: String((e && e.message) || e) }); }

// components/nuggets/RandomNugget.jsx
try { (() => {
function RandomNugget({
  tag = null,
  onDraw,
  buttonLabel = 'Draw a nugget',
  buttonVariant = 'secondary',
  style
}) {
  const [open, setOpen] = React.useState(false);
  const [idea, setIdea] = React.useState(null);
  const draw = () => {
    const next = onDraw ? onDraw(tag) : null;
    setIdea(next);
    setOpen(true);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: buttonVariant,
    onClick: draw,
    style: style,
    iconLeft: /*#__PURE__*/React.createElement("span", {
      style: {
        width: 15,
        height: 12,
        borderRadius: 'var(--radius-nugget)',
        background: 'var(--nug-golden-400)',
        border: '1.5px solid var(--nug-golden-700)',
        display: 'block'
      }
    })
  }, buttonLabel), /*#__PURE__*/React.createElement(__ds_scope.Dialog, {
    open: open,
    width: 480,
    onClose: () => setOpen(false),
    title: idea ? 'Your challenge' : 'Nothing to draw',
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.Button, {
      variant: "ghost",
      onClick: () => setOpen(false)
    }, "Close"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
      variant: "secondary",
      onClick: draw
    }, "Reroll"))
  }, idea ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: '4px 0 2px'
    }
  }, tag && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-micro)',
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase',
      color: 'var(--nug-ink-500)'
    }
  }, "narrowed to ", tag), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-title-1)',
      fontWeight: 'var(--weight-bold)',
      textWrap: 'pretty'
    }
  }, idea.title), idea.notes && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-body-md)',
      color: 'var(--nug-ink-700)',
      textWrap: 'pretty'
    }
  }, idea.notes), idea.tags && idea.tags.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 2
    }
  }, idea.tags.map(t => /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: t,
    name: t
  })))) : /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--nug-ink-500)'
    }
  }, "No active nuggets match that tag. Drop one in first.")));
}
Object.assign(__ds_scope, { RandomNugget });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nuggets/RandomNugget.jsx", error: String((e && e.message) || e) }); }

// components/nuggets/TagCombobox.jsx
try { (() => {
const normalise = s => s.trim().toLowerCase();
function TagCombobox({
  value = [],
  options = [],
  onChange,
  label = 'Tags',
  placeholder = 'Add a tag…',
  style
}) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const norm = normalise(q);
  const matches = options.filter(o => o.includes(norm) && !value.includes(o)).slice(0, 6);
  const isNew = norm.length > 0 && !options.includes(norm);
  const rows = isNew ? [...matches, {
    create: norm
  }] : matches;
  const add = name => {
    const n = normalise(name);
    if (n && !value.includes(n)) onChange && onChange([...value, n]);
    setQ('');
    setCursor(0);
  };
  const key = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = rows[cursor];
      if (r) add(typeof r === 'string' ? r : r.create);
    } else if (e.key === 'Backspace' && q === '' && value.length) {
      onChange && onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginBottom: 6,
      fontSize: 'var(--text-label)',
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase',
      color: 'var(--nug-ink-500)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      minHeight: 44,
      padding: '7px 10px',
      background: 'var(--nug-white)',
      border: `var(--border-regular) solid ${open ? 'var(--nug-golden-500)' : 'var(--nug-ink-200)'}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: open ? 'var(--focus-shadow)' : 'none',
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
    }
  }, value.map(t => /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    key: t,
    name: t,
    onRemove: () => onChange && onChange(value.filter(x => x !== t))
  })), /*#__PURE__*/React.createElement("input", {
    value: q,
    placeholder: value.length ? '' : placeholder,
    onChange: e => {
      setQ(e.target.value);
      setOpen(true);
      setCursor(0);
    },
    onFocus: () => setOpen(true),
    onBlur: () => setTimeout(() => setOpen(false), 120),
    onKeyDown: key,
    style: {
      flex: 1,
      minWidth: 90,
      height: 28,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      font: 'inherit',
      fontSize: 'var(--text-body-md)',
      color: 'var(--text-body)'
    }
  })), q && norm !== q && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 5,
      fontSize: 'var(--text-body-sm)',
      color: 'var(--nug-ink-500)'
    }
  }, "Saved as ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)'
    }
  }, norm)), open && rows.length > 0 && /*#__PURE__*/React.createElement("div", {
    role: "listbox",
    style: {
      position: 'absolute',
      zIndex: 40,
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 6,
      background: 'var(--nug-white)',
      border: 'var(--border-regular) solid var(--nug-ink-200)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-2)',
      overflow: 'hidden',
      padding: 4
    }
  }, rows.map((r, i) => {
    const create = typeof r !== 'string';
    const name = create ? r.create : r;
    return /*#__PURE__*/React.createElement("div", {
      key: name + (create ? '-new' : ''),
      role: "option",
      "aria-selected": i === cursor,
      onMouseEnter: () => setCursor(i),
      onMouseDown: e => {
        e.preventDefault();
        add(name);
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 9px',
        borderRadius: 'var(--radius-sm)',
        background: i === cursor ? 'var(--nug-cream-200)' : 'transparent',
        cursor: 'pointer',
        fontSize: 'var(--text-body-md)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Tag, {
      name: name
    }), create && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontSize: 'var(--text-body-sm)',
        color: 'var(--nug-ink-500)'
      }
    }, "new tag"));
  })));
}
Object.assign(__ds_scope, { TagCombobox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nuggets/TagCombobox.jsx", error: String((e && e.message) || e) }); }

// components/nuggets/IdeaForm.jsx
try { (() => {
function IdeaForm({
  open = false,
  mode = 'create',
  idea,
  tagOptions = [],
  onSubmit,
  onClose,
  error
}) {
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [tags, setTags] = React.useState([]);
  const [local, setLocal] = React.useState(null);
  React.useEffect(() => {
    if (!open) return;
    setTitle(idea && idea.title || '');
    setNotes(idea && idea.notes || '');
    setTags(idea && idea.tags || []);
    setLocal(null);
  }, [open, idea]);
  const submit = () => {
    if (!title.trim()) {
      setLocal('A nugget needs a title.');
      return;
    }
    onSubmit && onSubmit({
      title: title.trim(),
      notes,
      tags
    });
  };
  const msg = local || error;
  return /*#__PURE__*/React.createElement(__ds_scope.Dialog, {
    open: open,
    width: 520,
    onClose: onClose,
    title: mode === 'create' ? 'Drop a nugget' : 'Edit nugget',
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.Button, {
      variant: "ghost",
      onClick: onClose
    }, "Cancel"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
      onClick: submit
    }, mode === 'create' ? 'Drop it in' : 'Save'))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Input, {
    label: "Title",
    placeholder: "What's the idea?",
    value: title,
    onChange: e => {
      setTitle(e.target.value);
      setLocal(null);
    },
    error: msg || undefined
  }), /*#__PURE__*/React.createElement(__ds_scope.Textarea, {
    label: "Notes",
    rows: 4,
    placeholder: "Anything else worth remembering.",
    value: notes,
    onChange: e => setNotes(e.target.value)
  }), /*#__PURE__*/React.createElement(__ds_scope.TagCombobox, {
    value: tags,
    options: tagOptions,
    onChange: setTags
  })));
}
Object.assign(__ds_scope, { IdeaForm });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nuggets/IdeaForm.jsx", error: String((e && e.message) || e) }); }

// components/nuggets/TagFilter.jsx
try { (() => {
function TagFilter({
  tags = [],
  value = null,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onChange && onChange(null),
    style: {
      height: 26,
      padding: '0 12px',
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer',
      background: value === null ? 'var(--nug-ink-900)' : 'transparent',
      border: `var(--border-hairline) solid ${value === null ? 'var(--nug-ink-900)' : 'var(--nug-ink-200)'}`,
      color: value === null ? 'var(--nug-cream-50)' : 'var(--nug-ink-500)',
      font: 'inherit',
      fontSize: 'var(--text-body-sm)',
      fontWeight: 'var(--weight-semibold)',
      transition: 'all var(--dur-fast) var(--ease-out)'
    }
  }, "All"), tags.map(t => {
    const name = typeof t === 'string' ? t : t.name;
    const count = typeof t === 'string' ? undefined : t.count;
    return /*#__PURE__*/React.createElement(__ds_scope.Tag, {
      key: name,
      name: name,
      count: count,
      active: value === name,
      onClick: () => onChange && onChange(value === name ? null : name)
    });
  }));
}
Object.assign(__ds_scope, { TagFilter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nuggets/TagFilter.jsx", error: String((e && e.message) || e) }); }

// components/nuggets/IdeaList.jsx
try { (() => {
function IdeaList({
  ideas = [],
  tags = [],
  query = '',
  activeTag = null,
  onQueryChange,
  onTagChange,
  onOpen,
  rowActions,
  emptyAction,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SearchField, {
    value: query,
    onChange: onQueryChange,
    onClear: () => onQueryChange && onQueryChange({
      target: {
        value: ''
      }
    })
  }), tags.length > 0 && /*#__PURE__*/React.createElement(__ds_scope.TagFilter, {
    tags: tags,
    value: activeTag,
    onChange: onTagChange
  }), ideas.length === 0 ? /*#__PURE__*/React.createElement(__ds_scope.EmptyState, {
    headline: query || activeTag ? 'No nuggets match' : 'Nothing in the bank yet',
    body: query || activeTag ? 'Try a different word, or clear the tag filter.' : 'Drop your first nugget in. Half-formed is fine.',
    action: emptyAction
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 14
    }
  }, ideas.map(i => /*#__PURE__*/React.createElement(__ds_scope.IdeaCard, {
    key: i.id,
    title: i.title,
    notes: i.notes,
    tags: i.tags,
    date: i.date,
    onClick: onOpen ? () => onOpen(i) : undefined,
    actions: rowActions ? rowActions(i) : undefined
  }))));
}
Object.assign(__ds_scope, { IdeaList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nuggets/IdeaList.jsx", error: String((e && e.message) || e) }); }

// components/nuggets/TrashView.jsx
try { (() => {
function TrashView({
  ideas = [],
  onRestore,
  onPurge,
  style
}) {
  if (ideas.length === 0) {
    return /*#__PURE__*/React.createElement(__ds_scope.EmptyState, {
      variant: "bucket",
      headline: "Trash is empty",
      body: "Archived nuggets land here. Nothing has been binned yet.",
      style: style
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      ...style
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-body-sm)',
      color: 'var(--nug-ink-500)'
    }
  }, "Archived nuggets, newest binned first. Restoring puts one back in the bank; purging is permanent."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 14
    }
  }, ideas.map(i => /*#__PURE__*/React.createElement(__ds_scope.IdeaCard, {
    key: i.id,
    archived: true,
    title: i.title,
    notes: i.notes,
    tags: i.tags,
    date: i.archivedAt,
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.Button, {
      size: "sm",
      variant: "secondary",
      onClick: () => onRestore && onRestore(i.id)
    }, "Restore"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
      size: "sm",
      variant: "danger",
      onClick: () => onPurge && onPurge(i.id)
    }, "Purge"))
  }))));
}
Object.assign(__ds_scope, { TrashView });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nuggets/TrashView.jsx", error: String((e && e.message) || e) }); }

// prototype/browser-window.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
// Copied omelette starter. Re-running copy_starter_component with this kind overwrites this file with the latest version (page content is unaffected).

/* BEGIN USAGE */
// Chrome.jsx — Simplified Chrome browser window (dark theme, macOS)
// No dependencies, no image assets. All inline styles + inline SVG.
// Exports (to window): ChromeWindow, ChromeTabBar, ChromeToolbar, ChromeTab, ChromeTrafficLights
//
// Usage — wrap your page content in <ChromeWindow> to get the tab bar + URL bar:
//
//   <ChromeWindow width={1100} height={680} url="acme.design/pricing">
//     ...your page content...
//   </ChromeWindow>
/* END USAGE */

const CHROME_C = {
  barBg: '#202124',
  tabBg: '#35363a',
  text: '#e8eaed',
  dim: '#9aa0a6',
  urlBg: '#282a2d'
};
function ChromeTrafficLights() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      padding: '0 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#ff5f57'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#febc2e'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: '#28c840'
    }
  }));
}

// Single tab (active has curved scoops)
function ChromeTab({
  title = 'New Tab',
  active = false
}) {
  const curve = flip => /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "10",
    viewBox: "0 0 8 10",
    style: {
      position: 'absolute',
      bottom: 0,
      [flip ? 'right' : 'left']: -8,
      transform: flip ? 'scaleX(-1)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 10C2 9 6 8 8 0V10H0Z",
    fill: CHROME_C.tabBg
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 34,
      alignSelf: 'flex-end',
      padding: '0 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: active ? CHROME_C.tabBg : 'transparent',
      borderRadius: '8px 8px 0 0',
      minWidth: 120,
      maxWidth: 220,
      fontFamily: 'system-ui, sans-serif',
      fontSize: 12,
      color: active ? CHROME_C.text : CHROME_C.dim
    }
  }, active && curve(false), active && curve(true), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: '#5f6368',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, title));
}
function ChromeTabBar({
  tabs = [{
    title: 'New Tab'
  }],
  activeIndex = 0
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      height: 44,
      background: CHROME_C.barBg,
      paddingRight: 8
    }
  }, /*#__PURE__*/React.createElement(ChromeTrafficLights, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      height: '100%',
      paddingLeft: 4,
      flex: 1
    }
  }, tabs.map((t, i) => /*#__PURE__*/React.createElement(ChromeTab, {
    key: i,
    title: t.title,
    active: i === activeIndex
  }))));
}
function ChromeToolbar({
  url = 'example.com'
}) {
  const iconDot = /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: CHROME_C.dim,
      opacity: 0.4
    }
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 40,
      background: CHROME_C.tabBg,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '0 8px'
    }
  }, iconDot, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 30,
      borderRadius: 15,
      background: CHROME_C.urlBg,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 14px',
      margin: '0 6px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: CHROME_C.dim,
      opacity: 0.4
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      color: CHROME_C.text,
      fontSize: 13,
      fontFamily: 'system-ui, sans-serif'
    }
  }, url)), iconDot);
}
function ChromeWindow({
  tabs = [{
    title: 'New Tab'
  }],
  activeIndex = 0,
  url = 'example.com',
  width = 900,
  height = 600,
  children
}) {
  return (
    /*#__PURE__*/
    // data-om-starter: inert presence marker — Claude Design's starter-usage
    // probe reads it; it renders nothing. Keep it on this root element.
    React.createElement("div", {
      "data-om-starter": "browser-window",
      style: {
        width,
        height,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        background: CHROME_C.tabBg
      }
    }, /*#__PURE__*/React.createElement(ChromeTabBar, {
      tabs: tabs,
      activeIndex: activeIndex
    }), /*#__PURE__*/React.createElement(ChromeToolbar, {
      url: url
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        background: '#fff',
        overflow: 'auto'
      }
    }, children))
  );
}
Object.assign(window, {
  ChromeWindow,
  ChromeTabBar,
  ChromeToolbar,
  ChromeTab,
  ChromeTrafficLights
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "prototype/browser-window.jsx", error: String((e && e.message) || e) }); }

// prototype/ios-frame.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
// Copied omelette starter. Re-running copy_starter_component with this kind overwrites this file with the latest version (page content is unaffected).

/* BEGIN USAGE */
// iOS.jsx — Simplified iOS 26 (Liquid Glass) device frame
// Based on the iOS 26 UI Kit + Figma status bar spec. No assets, no deps.
// Exports (to window): IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard
//
// Usage — wrap your screen content in <IOSDevice> to get the bezel, status bar
// and home indicator (props: title, dark, keyboard):
//
//   <IOSDevice title="Settings">
//     ...your screen content...
//   </IOSDevice>
//   <IOSDevice dark title="Search" keyboard>…</IOSDevice>
/* END USAGE */

// ─────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────
function IOSStatusBar({
  dark = false,
  time = '9:41'
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 154,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '21px 24px 19px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 20,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: '-apple-system, "SF Pro", system-ui',
      fontWeight: 590,
      fontSize: 17,
      lineHeight: '22px',
      color: c
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingTop: 1,
      paddingRight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "12",
    viewBox: "0 0 19 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7.5",
    width: "3.2",
    height: "4.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.8",
    y: "5",
    width: "3.2",
    height: "7",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.6",
    y: "2.5",
    width: "3.2",
    height: "9.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14.4",
    y: "0",
    width: "3.2",
    height: "12",
    rx: "0.7",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "12",
    viewBox: "0 0 17 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z",
    fill: c
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "10.5",
    r: "1.5",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "13",
    viewBox: "0 0 27 13"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "23",
    height: "12",
    rx: "3.5",
    stroke: c,
    strokeOpacity: "0.35",
    fill: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "9",
    rx: "2",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z",
    fill: c,
    fillOpacity: "0.4"
  }))));
}

// ─────────────────────────────────────────────────────────────
// Liquid glass pill — blur + tint + shine
// ─────────────────────────────────────────────────────────────
function IOSGlassPill({
  children,
  dark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      minWidth: 44,
      borderRadius: 9999,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Navigation bar — glass pills + large title
// ─────────────────────────────────────────────────────────────
function IOSNavBar({
  title = 'Title',
  dark = false,
  trailingIcon = true
}) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pillIcon = content => /*#__PURE__*/React.createElement(IOSGlassPill, {
    dark: dark
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, content));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 62,
      paddingBottom: 10,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "20",
    viewBox: "0 0 12 20",
    fill: "none",
    style: {
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2L2 10l8 8",
    stroke: muted,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), trailingIcon && pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "6",
    viewBox: "0 0 22 6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "3",
    r: "2.5",
    fill: muted
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      fontFamily: '-apple-system, system-ui',
      fontSize: 34,
      fontWeight: 700,
      lineHeight: '41px',
      color: text,
      letterSpacing: 0.4
    }
  }, title));
}

// ─────────────────────────────────────────────────────────────
// Grouped list (inset card, r:26) + row (52px)
// ─────────────────────────────────────────────────────────────
function IOSListRow({
  title,
  detail,
  icon,
  chevron = true,
  isLast = false,
  dark = false
}) {
  const text = dark ? '#fff' : '#000';
  const sec = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const ter = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const sep = dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 52,
      padding: '0 16px',
      position: 'relative',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      letterSpacing: -0.43
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: icon,
      marginRight: 12,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: text
    }
  }, title), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      color: sec,
      marginRight: 6
    }
  }, detail), chevron && /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "14",
    viewBox: "0 0 8 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l6 6-6 6",
    stroke: ter,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: icon ? 58 : 16,
      height: 0.5,
      background: sep
    }
  }));
}
function IOSList({
  header,
  children,
  dark = false
}) {
  const hc = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const bg = dark ? '#1C1C1E' : '#fff';
  return /*#__PURE__*/React.createElement("div", null, header && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: '-apple-system, system-ui',
      fontSize: 13,
      color: hc,
      textTransform: 'uppercase',
      padding: '8px 36px 6px',
      letterSpacing: -0.08
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 26,
      margin: '0 16px',
      overflow: 'hidden'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Device frame
// ─────────────────────────────────────────────────────────────
function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false
}) {
  return (
    /*#__PURE__*/
    // data-om-starter: inert presence marker — Claude Design's starter-usage
    // probe reads it; it renders nothing. Keep it on this root element.
    React.createElement("div", {
      "data-om-starter": "ios-frame",
      style: {
        width,
        height,
        borderRadius: 48,
        overflow: 'hidden',
        position: 'relative',
        background: dark ? '#000' : '#F2F2F7',
        boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
        fontFamily: '-apple-system, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 11,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 126,
        height: 37,
        borderRadius: 24,
        background: '#000',
        zIndex: 50
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10
      }
    }, /*#__PURE__*/React.createElement(IOSStatusBar, {
      dark: dark
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }
    }, title !== undefined && /*#__PURE__*/React.createElement(IOSNavBar, {
      title: title,
      dark: dark
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflow: 'auto'
      }
    }, children), keyboard && /*#__PURE__*/React.createElement(IOSKeyboard, {
      dark: dark
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        height: 34,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingBottom: 8,
        pointerEvents: 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 139,
        height: 5,
        borderRadius: 100,
        background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'
      }
    })))
  );
}

// ─────────────────────────────────────────────────────────────
// Keyboard — iOS 26 liquid glass
// ─────────────────────────────────────────────────────────────
function IOSKeyboard({
  dark = false
}) {
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959';
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333';
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';

  // special-key icons
  const icons = {
    shift: /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "17",
      viewBox: "0 0 19 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z",
      fill: glyph
    })),
    del: /*#__PURE__*/React.createElement("svg", {
      width: "23",
      height: "17",
      viewBox: "0 0 23 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z",
      fill: "none",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 5l7 7M17 5l-7 7",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    ret: /*#__PURE__*/React.createElement("svg", {
      width: "20",
      height: "14",
      viewBox: "0 0 20 14"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 1v6H4m0 0l4-4M4 7l4 4",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  const key = (content, {
    w,
    flex,
    ret,
    fs = 25,
    k
  } = {}) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      height: 42,
      borderRadius: 8.5,
      flex: flex ? 1 : undefined,
      width: w,
      minWidth: 0,
      background: ret ? '#08f' : keyBg,
      boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Compact", system-ui',
      fontSize: fs,
      fontWeight: 458,
      color: ret ? '#fff' : glyph
    }
  }, content);
  const row = (keys, pad = 0) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      justifyContent: 'center',
      padding: `0 ${pad}px`
    }
  }, keys.map(l => key(l, {
    flex: true,
    k: l
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 15,
      borderRadius: 27,
      overflow: 'hidden',
      padding: '11px 0 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: dark ? '0 -2px 20px rgba(0,0,0,0.09)' : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      padding: '8px 22px 13px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, ['"The"', 'the', 'to'].map((w, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 25,
      background: '#ccc',
      opacity: 0.3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      color: sugg,
      letterSpacing: -0.43,
      lineHeight: '22px'
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      padding: '0 6.5px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']), row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14.25,
      alignItems: 'center'
    }
  }, key(icons.shift, {
    w: 45,
    k: 'shift'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      flex: 1
    }
  }, ['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(l => key(l, {
    flex: true,
    k: l
  }))), key(icons.del, {
    w: 45,
    k: 'del'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, key('ABC', {
    w: 92.25,
    fs: 18,
    k: 'abc'
  }), key('', {
    flex: true,
    k: 'space'
  }), key(icons.ret, {
    w: 92.25,
    ret: true,
    k: 'ret'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      width: '100%',
      position: 'relative'
    }
  }));
}
Object.assign(window, {
  IOSDevice,
  IOSStatusBar,
  IOSNavBar,
  IOSGlassPill,
  IOSList,
  IOSListRow,
  IOSKeyboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "prototype/ios-frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing_site/Landing.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  Button,
  Wordmark,
  NuggetMark,
  Card,
  Badge,
  IdeaCard,
  Tag
} = window.NuggetsDesignSystem_33854b;
const icon = (name, size = 18) => React.createElement('i', {
  'data-lucide': name,
  style: {
    width: size,
    height: size,
    display: 'flex'
  }
});
const FEATURES = [{
  icon: 'pencil-line',
  title: 'Capture',
  body: 'An idea as a title plus notes, tagged however you like.'
}, {
  icon: 'hash',
  title: 'Tag',
  body: 'Tags autocomplete from ones already used, so you never end up with #saas and #SaaS.'
}, {
  icon: 'search',
  title: 'Find',
  body: 'Search the text, or filter by tag. Both at once narrows to ideas matching both.'
}, {
  icon: 'dices',
  title: 'Draw a random nugget',
  body: 'One button returns a random idea as a mini-challenge. Reroll as often as you like.'
}, {
  icon: 'archive',
  title: 'Archive, never delete',
  body: 'A trash view to restore from. Losing an idea should take deliberate effort.'
}];
const STACK = [['Backend', 'Go — stdlib net/http, SQLite via modernc.org/sqlite, goose migrations'], ['Frontend', 'TypeScript, React, Vite, Tailwind, a little shadcn/ui'], ['Shape', 'One Go binary serving the API and the embedded frontend at 127.0.0.1:7777'], ['Data', 'A single SQLite file. Backup is copying it.']];
function Section({
  background,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background,
      padding: '84px var(--gutter-marketing)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--page-max)',
      margin: '0 auto'
    }
  }, children));
}
function Landing() {
  const [drawn, setDrawn] = React.useState(0);
  const demo = [{
    title: 'Tailnet-only sharing',
    notes: 'Expose the bank over Tailscale so the phone can reach it.',
    tags: ['go', 'infra']
  }, {
    title: 'Draw a nugget, then timebox it',
    notes: 'The random draw picks an idea and starts a 25-minute timer.',
    tags: ['product']
  }, {
    title: 'FTS5 search when LIKE stops being enough',
    notes: 'The driver already ships it. Not worth it below a few thousand rows.',
    tags: ['go', 'search']
  }];
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons({
      attrs: {
        'stroke-width': 2.2
      }
    });
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      height: 68,
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      padding: '0 var(--gutter-marketing)',
      background: 'var(--nug-cream-50)',
      borderBottom: 'var(--border-hairline) solid var(--nug-ink-200)'
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    size: 24
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: "golden"
  }, "Designed, not built yet"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    iconLeft: icon('github', 16)
  }, "View the repo")), /*#__PURE__*/React.createElement(Section, {
    background: "var(--nug-cream-100)",
    style: {
      backgroundImage: 'var(--texture-breading)',
      backgroundSize: 'var(--texture-breading-size)',
      paddingTop: 96,
      paddingBottom: 96
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.15fr .85fr',
      gap: 56,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-display-1)',
      lineHeight: 'var(--leading-tight)',
      textWrap: 'pretty'
    }
  }, "An idea bank for the ideas you keep losing."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: '46ch',
      fontSize: 'var(--text-body-lg)',
      lineHeight: 'var(--leading-loose)',
      color: 'var(--nug-ink-700)',
      textWrap: 'pretty'
    }
  }, "nuggets stores every idea you thought was cool to build at some point in your life \u2014 with enough structure to find one on purpose, and a button to surface one at random when you feel like a challenge."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    iconLeft: icon('github', 18)
  }, "Read the design spec"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "ghost"
  }, "See the app")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-body-sm)',
      color: 'var(--nug-ink-500)'
    }
  }, "Local-first \xB7 single user \xB7 zero recurring cost")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(NuggetMark, {
    variant: "trio",
    size: 430
  })))), /*#__PURE__*/React.createElement(Section, {
    background: "var(--nug-white)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '.9fr 1.1fr',
      gap: 56,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-label)',
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--nug-ink-500)'
    }
  }, "Why"), /*#__PURE__*/React.createElement("h2", {
    style: {
      marginTop: 12,
      fontSize: 'var(--text-display-2)',
      lineHeight: 'var(--leading-snug)',
      textWrap: 'pretty'
    }
  }, "The idea isn't lost exactly."), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 16,
      maxWidth: '46ch',
      fontSize: 'var(--text-body-lg)',
      lineHeight: 'var(--leading-loose)',
      color: 'var(--nug-ink-700)',
      textWrap: 'pretty'
    }
  }, "Ideas turn up when you're out, so they get typed into Telegram or WhatsApp as messages to yourself. They survive there, but they end up buried among links, reminders and everything else saved to the same thread. It's just never found again \u2014 which comes to the same thing.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, demo.map((d, i) => /*#__PURE__*/React.createElement(IdeaCard, _extends({
    key: d.title
  }, d, {
    date: ['2d ago', '4d ago', '3w ago'][i],
    biteBackground: "var(--nug-white)",
    bitten: i === drawn
  }))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setDrawn((drawn + 1) % 3),
    style: {
      alignSelf: 'flex-start',
      marginTop: 4,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      font: 'inherit',
      fontSize: 'var(--text-body-sm)',
      color: 'var(--nug-golden-700)',
      padding: 0
    }
  }, "Draw another \u2192")))), /*#__PURE__*/React.createElement(Section, {
    background: "var(--nug-cream-100)"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-display-2)',
      marginBottom: 8
    }
  }, "What it does"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 36px',
      fontSize: 'var(--text-body-lg)',
      color: 'var(--nug-ink-700)'
    }
  }, "Five things. That's the whole scope, deliberately."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16
    }
  }, FEATURES.map(f => /*#__PURE__*/React.createElement(Card, {
    key: f.title,
    tone: "plain",
    padding: 22,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 40,
      height: 34,
      borderRadius: 'var(--radius-nugget)',
      background: 'var(--nug-golden-200)',
      border: 'var(--border-regular) solid var(--nug-golden-600)',
      color: 'var(--nug-golden-700)'
    }
  }, icon(f.icon, 18)), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-title-3)'
    }
  }, f.title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-body-sm)',
      color: 'var(--nug-ink-700)',
      textWrap: 'pretty'
    }
  }, f.body))))), /*#__PURE__*/React.createElement(Section, {
    background: "var(--nug-ink-900)",
    style: {
      color: 'var(--nug-cream-50)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '.85fr 1.15fr',
      gap: 56
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-display-2)',
      color: 'var(--nug-cream-50)',
      textWrap: 'pretty'
    }
  }, "Zero cost, no asterisks."), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 16,
      fontSize: 'var(--text-body-lg)',
      lineHeight: 'var(--leading-loose)',
      color: 'var(--nug-cream-200)',
      textWrap: 'pretty'
    }
  }, "No account, no cloud, no service. One binary, one SQLite file on your own machine, and a browser tab that opens itself.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      border: 'var(--border-regular) solid rgba(253,244,227,.16)'
    }
  }, STACK.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'grid',
      gridTemplateColumns: '128px 1fr',
      gap: 18,
      padding: '15px 20px',
      background: 'rgba(253,244,227,.05)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--nug-golden-300)'
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-sm)',
      color: 'var(--nug-cream-200)',
      lineHeight: 'var(--leading-normal)'
    }
  }, v)))))), /*#__PURE__*/React.createElement(Section, {
    background: "var(--nug-cream-100)",
    style: {
      paddingTop: 68,
      paddingBottom: 68
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 36
    }
  }, /*#__PURE__*/React.createElement(NuggetMark, {
    variant: "single",
    size: 104,
    bitten: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-title-1)',
      textWrap: 'pretty'
    }
  }, "There's nothing to install yet."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 0 0',
      maxWidth: '58ch',
      fontSize: 'var(--text-body-md)',
      color: 'var(--nug-ink-700)',
      textWrap: 'pretty'
    }
  }, "The full design is public \u2014 data model, API, and the reasoning behind each stack choice. This section gets setup instructions once there's something to set up.")), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    iconLeft: icon('github', 18)
  }, "Read the spec"))), /*#__PURE__*/React.createElement("footer", {
    style: {
      padding: '30px var(--gutter-marketing)',
      background: 'var(--nug-cream-50)',
      borderTop: 'var(--border-hairline) solid var(--nug-ink-200)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--page-max)',
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    name: "go"
  }), /*#__PURE__*/React.createElement(Tag, {
    name: "sqlite"
  }), /*#__PURE__*/React.createElement(Tag, {
    name: "local-first"
  })))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Landing, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing_site/Landing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/PhoneApp.jsx
try { (() => {
const {
  SearchField,
  Button,
  IconButton,
  IdeaCard,
  TagFilter,
  IdeaForm,
  RandomNugget,
  TrashView,
  EmptyState,
  Dialog,
  Wordmark
} = window.NuggetsDesignSystem_33854b;
const icon = (name, size = 16) => React.createElement('i', {
  'data-lucide': name,
  style: {
    width: size,
    height: size,
    display: 'flex'
  }
});
function MobileApp() {
  const seed = window.NUG_SEED;
  const [ideas, setIdeas] = React.useState(seed.ideas);
  const [archived, setArchived] = React.useState(seed.archived);
  const [query, setQuery] = React.useState('');
  const [tag, setTag] = React.useState(null);
  const [view, setView] = React.useState('bank');
  const [form, setForm] = React.useState(null);
  const [purge, setPurge] = React.useState(null);
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons({
      attrs: {
        'stroke-width': 2.2
      }
    });
  });
  const counts = seed.tags.map(t => ({
    name: t,
    count: ideas.filter(i => i.tags.includes(t)).length
  })).filter(t => t.count > 0);
  const q = query.trim().toLowerCase();
  const shown = ideas.filter(i => (!q || i.title.toLowerCase().includes(q) || (i.notes || '').toLowerCase().includes(q)) && (!tag || i.tags.includes(tag)));
  const save = draft => {
    if (form && form.mode === 'edit') setIdeas(l => l.map(i => i.id === form.idea.id ? {
      ...i,
      ...draft
    } : i));else setIdeas(l => [{
      id: Date.now(),
      ...draft,
      date: 'just now'
    }, ...l]);
    setForm(null);
  };
  const archive = id => {
    const it = ideas.find(i => i.id === id);
    setIdeas(l => l.filter(i => i.id !== id));
    setArchived(l => [{
      ...it,
      archivedAt: 'binned just now'
    }, ...l]);
  };
  const restore = id => {
    const it = archived.find(i => i.id === id);
    setArchived(l => l.filter(i => i.id !== id));
    setIdeas(l => [{
      ...it,
      date: 'restored just now'
    }, ...l]);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: 'var(--surface-page)',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: 96
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'var(--nug-cream-50)',
      borderBottom: 'var(--border-hairline) solid var(--nug-ink-200)',
      padding: '10px var(--gutter-mobile) 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minHeight: 44
    }
  }, view === 'bank' ? /*#__PURE__*/React.createElement(Wordmark, {
    size: 20
  }) : /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-title-3)'
    }
  }, "Trash"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), view === 'bank' && /*#__PURE__*/React.createElement(RandomNugget, {
    buttonLabel: "Draw",
    onDraw: () => shown.length ? shown[Math.floor(Math.random() * shown.length)] : null,
    tag: tag
  }), /*#__PURE__*/React.createElement(IconButton, {
    label: view === 'bank' ? 'Trash' : 'Back to the bank',
    variant: "outline",
    onClick: () => setView(view === 'bank' ? 'trash' : 'bank')
  }, icon(view === 'bank' ? 'trash-2' : 'arrow-left'))), view === 'bank' && /*#__PURE__*/React.createElement(SearchField, {
    value: query,
    onChange: e => setQuery(e.target.value),
    onClear: () => setQuery('')
  })), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      padding: '14px var(--gutter-mobile) 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, view === 'bank' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      paddingBottom: 2,
      margin: '0 calc(var(--gutter-mobile) * -1)',
      padding: '0 var(--gutter-mobile) 2px'
    }
  }, /*#__PURE__*/React.createElement(TagFilter, {
    tags: counts,
    value: tag,
    onChange: setTag,
    style: {
      flexWrap: 'nowrap'
    }
  })), shown.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    headline: q || tag ? 'No nuggets match' : 'Nothing in the bank yet',
    body: q || tag ? 'Try a different word, or clear the tag filter.' : 'Drop your first nugget in. Half-formed is fine.',
    action: /*#__PURE__*/React.createElement(Button, {
      onClick: () => setForm({
        mode: 'create'
      })
    }, "Drop a nugget")
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, shown.map(i => /*#__PURE__*/React.createElement(IdeaCard, {
    key: i.id,
    title: i.title,
    notes: i.notes,
    tags: i.tags,
    date: i.date,
    seed: String(i.id),
    onClick: () => setForm({
      mode: 'edit',
      idea: i
    }),
    actions: /*#__PURE__*/React.createElement("span", {
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(IconButton, {
      label: "Archive",
      onClick: () => archive(i.id)
    }, icon('archive')))
  })))) : /*#__PURE__*/React.createElement(TrashView, {
    ideas: archived,
    onRestore: restore,
    onPurge: id => setPurge(archived.find(a => a.id === id))
  })), view === 'bank' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      padding: '14px var(--gutter-mobile) 22px',
      background: 'linear-gradient(to top, var(--surface-page) 62%, rgba(253,244,227,0))'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    size: "lg",
    onClick: () => setForm({
      mode: 'create'
    }),
    iconLeft: icon('plus', 18)
  }, "Drop a nugget")), /*#__PURE__*/React.createElement(IdeaForm, {
    open: !!form,
    mode: form ? form.mode : 'create',
    idea: form ? form.idea : undefined,
    tagOptions: seed.tags,
    onSubmit: save,
    onClose: () => setForm(null)
  }), /*#__PURE__*/React.createElement(Dialog, {
    open: !!purge,
    width: 330,
    title: "Purge this nugget?",
    description: purge ? `"${purge.title}" is gone for good.` : '',
    onClose: () => setPurge(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setPurge(null)
    }, "Keep it"), /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      onClick: () => {
        setArchived(l => l.filter(a => a.id !== purge.id));
        setPurge(null);
      }
    }, "Purge"))
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(MobileApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/PhoneApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web_app/BankApp.jsx
try { (() => {
const {
  TopBar,
  SearchField,
  Button,
  IconButton,
  IdeaCard,
  TagFilter,
  IdeaForm,
  RandomNugget,
  TrashView,
  EmptyState,
  Dialog,
  Wordmark
} = window.NuggetsDesignSystem_33854b;
const icon = (name, size = 16) => React.createElement('i', {
  'data-lucide': name,
  style: {
    width: size,
    height: size,
    display: 'flex'
  }
});
function NuggetsApp() {
  const seed = window.NUG_SEED;
  const [ideas, setIdeas] = React.useState(seed.ideas);
  const [archived, setArchived] = React.useState(seed.archived);
  const [query, setQuery] = React.useState('');
  const [tag, setTag] = React.useState(null);
  const [view, setView] = React.useState('bank');
  const [form, setForm] = React.useState(null);
  const [purge, setPurge] = React.useState(null);
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons({
      attrs: {
        'stroke-width': 2.2
      }
    });
  });
  const tagCounts = seed.tags.map(t => ({
    name: t,
    count: ideas.filter(i => i.tags.includes(t)).length
  })).filter(t => t.count > 0);
  const q = query.trim().toLowerCase();
  const shown = ideas.filter(i => (!q || i.title.toLowerCase().includes(q) || (i.notes || '').toLowerCase().includes(q)) && (!tag || i.tags.includes(tag)));
  const save = draft => {
    if (form && form.mode === 'edit') {
      setIdeas(list => list.map(i => i.id === form.idea.id ? {
        ...i,
        ...draft
      } : i));
    } else {
      setIdeas(list => [{
        id: Date.now(),
        ...draft,
        date: 'just now'
      }, ...list]);
    }
    setForm(null);
  };
  const archive = id => {
    const it = ideas.find(i => i.id === id);
    setIdeas(list => list.filter(i => i.id !== id));
    setArchived(list => [{
      ...it,
      archivedAt: 'binned just now'
    }, ...list]);
  };
  const restore = id => {
    const it = archived.find(i => i.id === id);
    setArchived(list => list.filter(i => i.id !== id));
    setIdeas(list => [{
      ...it,
      date: 'restored just now'
    }, ...list]);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: 'var(--surface-page)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    center: view === 'bank' ? /*#__PURE__*/React.createElement(SearchField, {
      value: query,
      onChange: e => setQuery(e.target.value),
      onClear: () => setQuery(''),
      style: {
        width: 340
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 'var(--text-title-3)'
      }
    }, "Trash"),
    right: /*#__PURE__*/React.createElement(React.Fragment, null, view === 'bank' && /*#__PURE__*/React.createElement(RandomNugget, {
      tag: tag,
      onDraw: () => shown.length ? shown[Math.floor(Math.random() * shown.length)] : null
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: () => setView(view === 'bank' ? 'trash' : 'bank'),
      iconLeft: icon(view === 'bank' ? 'trash-2' : 'arrow-left')
    }, view === 'bank' ? `Trash${archived.length ? ' · ' + archived.length : ''}` : 'Back to the bank'), /*#__PURE__*/React.createElement(Button, {
      onClick: () => setForm({
        mode: 'create'
      }),
      iconLeft: icon('plus')
    }, "Drop a nugget"))
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      width: '100%',
      maxWidth: 1240,
      margin: '0 auto',
      padding: '28px var(--gutter-web) 72px'
    }
  }, view === 'bank' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-title-1)'
    }
  }, "The bank"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-body-sm)',
      color: 'var(--nug-ink-500)'
    }
  }, shown.length, " of ", ideas.length, " nuggets")), /*#__PURE__*/React.createElement(TagFilter, {
    tags: tagCounts,
    value: tag,
    onChange: setTag
  }), shown.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    headline: q || tag ? 'No nuggets match' : 'Nothing in the bank yet',
    body: q || tag ? 'Try a different word, or clear the tag filter.' : 'Drop your first nugget in. Half-formed is fine.',
    action: /*#__PURE__*/React.createElement(Button, {
      onClick: () => setForm({
        mode: 'create'
      })
    }, "Drop a nugget")
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 16
    }
  }, shown.map(i => /*#__PURE__*/React.createElement(IdeaCard, {
    key: i.id,
    title: i.title,
    notes: i.notes,
    tags: i.tags,
    date: i.date,
    onClick: () => setForm({
      mode: 'edit',
      idea: i
    }),
    actions: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        gap: 2
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(IconButton, {
      label: "Edit",
      onClick: () => setForm({
        mode: 'edit',
        idea: i
      })
    }, icon('pencil')), /*#__PURE__*/React.createElement(IconButton, {
      label: "Archive",
      onClick: () => archive(i.id)
    }, icon('archive')))
  })))) : /*#__PURE__*/React.createElement(TrashView, {
    ideas: archived,
    onRestore: restore,
    onPurge: id => setPurge(archived.find(a => a.id === id))
  })), /*#__PURE__*/React.createElement("footer", {
    style: {
      padding: '0 var(--gutter-web) 22px',
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--nug-ink-500)'
    }
  }, "127.0.0.1:7777 \xB7 single user \xB7 one SQLite file")), /*#__PURE__*/React.createElement(IdeaForm, {
    open: !!form,
    mode: form ? form.mode : 'create',
    idea: form ? form.idea : undefined,
    tagOptions: seed.tags,
    onSubmit: save,
    onClose: () => setForm(null)
  }), /*#__PURE__*/React.createElement(Dialog, {
    open: !!purge,
    width: 430,
    title: "Purge this nugget?",
    description: purge ? `"${purge.title}" is gone for good — restoring won't be an option.` : '',
    onClose: () => setPurge(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setPurge(null)
    }, "Keep it"), /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      onClick: () => {
        setArchived(list => list.filter(a => a.id !== purge.id));
        setPurge(null);
      }
    }, "Purge"))
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(NuggetsApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web_app/BankApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web_app/data.js
try { (() => {
// Seed data for the UI kit. Shapes match the API in
// docs/superpowers/specs/2026-08-29-nuggets-design.md section 6.
window.NUG_SEED = {
  ideas: [{
    id: 7,
    title: 'Tailnet-only sharing',
    notes: 'Expose the bank over Tailscale so the phone can reach it. No accounts, no hosting bill, no code changes to the Go binary.',
    tags: ['go', 'infra'],
    date: '2d ago'
  }, {
    id: 6,
    title: 'Draw a nugget, then timebox it',
    notes: 'The random draw picks an idea and starts a 25-minute timer alongside it. Turns the mini-challenge into an actual session.',
    tags: ['product'],
    date: '4d ago'
  }, {
    id: 5,
    title: 'Golden-JSON test for every API shape',
    notes: 'One testdata file per response type, compared byte-for-byte, so the hand-written TS types can never drift silently.',
    tags: ['go', 'testing'],
    date: '6d ago'
  }, {
    id: 4,
    title: 'Telegram drain command',
    notes: 'A one-off script that reads the self-message thread and files each message as a nugget. Fixes the backlog, not the habit.',
    tags: ['product', 'infra'],
    date: '1w ago'
  }, {
    id: 3,
    title: 'Status field: raw → building → parked',
    notes: 'Deliberately out of scope for the MVP. One migration adding nullable columns when it earns its place.',
    tags: ['product'],
    date: '2w ago'
  }, {
    id: 2,
    title: 'FTS5 search when LIKE stops being enough',
    notes: 'The driver already ships FTS5. Not worth it below a few thousand rows.',
    tags: ['go', 'search'],
    date: '3w ago'
  }],
  archived: [{
    id: 1,
    title: 'Chrome extension for capture',
    notes: 'Superseded by tailnet access — a browser extension only helps at a desk.',
    tags: ['browser'],
    archivedAt: 'binned 3d ago'
  }],
  tags: ['go', 'infra', 'product', 'testing', 'search', 'browser']
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web_app/data.js", error: String((e && e.message) || e) }); }

__ds_ns.NuggetMark = __ds_scope.NuggetMark;

__ds_ns.Wordmark = __ds_scope.Wordmark;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.TopBar = __ds_scope.TopBar;

__ds_ns.IdeaCard = __ds_scope.IdeaCard;

__ds_ns.IdeaForm = __ds_scope.IdeaForm;

__ds_ns.IdeaList = __ds_scope.IdeaList;

__ds_ns.RandomNugget = __ds_scope.RandomNugget;

__ds_ns.TagCombobox = __ds_scope.TagCombobox;

__ds_ns.TagFilter = __ds_scope.TagFilter;

__ds_ns.TrashView = __ds_scope.TrashView;

})();
