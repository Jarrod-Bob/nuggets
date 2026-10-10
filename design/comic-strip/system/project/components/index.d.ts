import type * as React from 'react';

export type NuggetStatus = 'raw' | 'exploring' | 'building' | 'parked' | 'killed' | 'done';

/** An inked comic panel. Every block on a page is one. */
export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  /** Fill: paper (default), mayo for the one feature panel, nugget, or tomato for the action panel. */
  tone?: 'paper' | 'mayo' | 'nugget' | 'tomato';
  /** Element to render. Default 'div'. */
  as?: keyof JSX.IntrinsicElements;
  /** Set false to drop the panel-pad padding (for illustration panels). Default true. */
  padded?: boolean;
}
export declare function Panel(props: PanelProps): React.ReactElement;

/** The nugget-gold strip at the top of every page: the wordmark, then the page's controls. */
export interface StripProps extends React.HTMLAttributes<HTMLElement> {
  /** Show the nuggets. wordmark first. Default true. */
  wordmark?: boolean;
}
export declare function Strip(props: StripProps): React.ReactElement;

/** The only button shape. */
export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** paper (default), tomato for the page's primary action, ink for a selected state. */
  variant?: 'paper' | 'tomato' | 'ink';
  /** lg for the single call to action on a page. */
  size?: 'md' | 'lg';
  /** Icon before the label. */
  icon?: 'search' | 'arrow-right' | 'arrow-left' | 'plus' | 'close' | 'check' | 'pencil' | 'dice';
  /** Icon after the label. */
  iconAfter?: 'search' | 'arrow-right' | 'arrow-left' | 'plus' | 'close' | 'check' | 'pencil' | 'dice';
}
export declare function Pill(props: PillProps): React.ReactElement;

/** A tag filter toggle. Children are the label, e.g. "#saas" or "all". */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
}
export declare function Chip(props: ChipProps): React.ReactElement;

/** The pill-shaped search input. */
export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Accessible name; falls back to the placeholder. */
  label?: string;
}
export declare function SearchField(props: SearchFieldProps): React.ReactElement;

/** A nugget's status as a word on its status fill. */
export interface StatusPillProps { status: NuggetStatus; className?: string }
export declare function StatusPill(props: StatusPillProps): React.ReactElement;

/** A nugget on the tray: a lumpy outline holding its status, age, title and tags. */
export interface NuggetCardProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  title: string;
  status: NuggetStatus;
  /** Short age: "2d", "today". */
  age?: string;
  /** Tag names without the hash; shown lowercase with one. */
  tags?: string[];
  /** Which of the 8 outlines to draw (0–7). Derive it from the nugget so it stays stable. */
  shape?: number;
  /** Resting rotation in degrees, about -4 to 4. */
  tilt?: number;
  /** The nugget's project name. Set, the card wears a curry dab that reveals it; unset, no sauce. */
  projectName?: string;
  /** Start with the curry pinned open (previews and screenshots). */
  sauceOpen?: boolean;
}
export declare function NuggetCard(props: NuggetCardProps): React.ReactElement;

/** The nugget motif: a generated lumpy nugget with an ink shadow. */
export interface NuggetMarkProps {
  /** Width in px. Default 120. */
  size?: number;
  /** Same seed, same nugget. Default 19. */
  seed?: number;
  /** Fill follows the status colours. Default 'building' (nugget gold). */
  status?: NuggetStatus;
  /** Give it an accessible name when it carries meaning; otherwise it is hidden from assistive tech. */
  label?: string;
  className?: string;
}
export declare function NuggetMark(props: NuggetMarkProps): React.ReactElement;

/** A speech bubble: a nugget's notes, or a shout from an illustration. */
export interface SpeechBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Where the tail points. Default 'left'. */
  tail?: 'left' | 'bottom';
  /** Mayo fill while the text is being edited. */
  editing?: boolean;
}
export declare function SpeechBubble(props: SpeechBubbleProps): React.ReactElement;

/** Sound-effect lettering for one event at a time. */
export interface SfxProps {
  children: React.ReactNode;
  /** sm 40px (bubble shouts, plain ink), md 56px (resting, in a panel), lg 120px (the event pop). */
  size?: 'sm' | 'md' | 'lg';
  /** Fill colour at md and lg. Default 'nugget'. */
  tone?: 'nugget' | 'tomato';
  /** Rotation in degrees. Default -6. */
  tilt?: number;
  /** Sound effects are hidden from assistive tech by default; set false if the word is the only label. */
  decorative?: boolean;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Sfx(props: SfxProps): React.ReactElement;

/** A sunburst of paper rays on mayo, behind the one feature illustration on a page. */
export interface BurstProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of rays (even). Default 44. */
  rays?: number;
}
export declare function Burst(props: BurstProps): React.ReactElement;

/** A narration box: a notice about the page, in the strip's caption style. */
export interface CaptionBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Fill. Default 'nugget'; use 'mayo' or 'paper' on a nugget-gold ground. */
  tone?: 'nugget' | 'mayo' | 'paper';
  /** The narrator's lead-in, e.g. "Meanwhile, on the tray…". */
  eyebrow?: React.ReactNode;
}
export declare function CaptionBox(props: CaptionBoxProps): React.ReactElement;

/** A dialog panel with a sticker shadow. Presentational: the host owns the overlay, focus trap and Escape. */
export interface DialogProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  /** Shows the round close button when set. */
  onClose?: () => void;
  /** Pills for the mayo footer: Cancel, then the one tomato pill. */
  footer?: React.ReactNode;
  /** Width in px or any CSS length. Default 560. */
  width?: number | string;
}
export declare function Dialog(props: DialogProps): React.ReactElement;

/** A labelled text input or textarea with an optional hint. */
export interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>, 'children'> {
  label: React.ReactNode;
  /** Help or a literal error, wired with aria-describedby. */
  hint?: React.ReactNode;
  /** Render a textarea. */
  multiline?: boolean;
  /** A control at the end of the input row, such as a Pill. */
  action?: React.ReactNode;
}
export declare function Field(props: FieldProps): React.ReactElement;

export interface KimiName { name: string; explanation: string }
/** The project-name generator: name field, dice pill, name stickers and why the pointed-at name was suggested. */
export interface NameSuggestionsProps {
  value: string;
  onChange?: (value: string) => void;
  /** Names from kimi; empty until the first roll. */
  names?: KimiName[];
  /** A sticker was picked. */
  onPick?: (name: string) => void;
  /** The dice was pressed: 'roll' for the first five names, 'reroll' for five not yet shown. */
  onRoll?: (kind: 'roll' | 'reroll') => void;
  /** Stop was pressed while rolling. */
  onCancel?: () => void;
  /** Default 'idle'. */
  state?: 'idle' | 'rolling' | 'failed';
  /** false once kimi's health check fails. */
  available?: boolean;
  /** No notes yet, so nothing to name. */
  notesEmpty?: boolean;
  className?: string;
}
export declare function NameSuggestions(props: NameSuggestionsProps): React.ReactElement;

export interface TagSuggestion { tag: string; examples: string[] }
/** Suggested tags, pencilled in, each with a ThoughtBubble saying why. Renders nothing when empty. */
export interface SuggestedTagsProps {
  suggestions: TagSuggestion[];
  onAdd?: (tag: string) => void;
  onDismiss?: (tag: string) => void;
  /** The tag whose add or dismiss is in flight. */
  busy?: string | null;
  /** Hold one tag's bubble open (previews only). */
  openTag?: string;
  className?: string;
}
export declare function SuggestedTags(props: SuggestedTagsProps): React.ReactElement | null;

/** A thought bubble: a reason or aside, with puffs trailing back to its subject. */
export interface ThoughtBubbleProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Which way it opens from its anchor. Default 'right'. */
  side?: 'right' | 'left';
  /** Default true. */
  open?: boolean;
}
export declare function ThoughtBubble(props: ThoughtBubbleProps): React.ReactElement;

declare global {
  interface Window {
    Comic: {
      Panel: typeof Panel; Strip: typeof Strip; Pill: typeof Pill; Chip: typeof Chip; SearchField: typeof SearchField;
      StatusPill: typeof StatusPill; NuggetCard: typeof NuggetCard; NuggetMark: typeof NuggetMark;
      SpeechBubble: typeof SpeechBubble; Sfx: typeof Sfx; Burst: typeof Burst;
      CaptionBox: typeof CaptionBox; Dialog: typeof Dialog; Field: typeof Field; NameSuggestions: typeof NameSuggestions;
      SuggestedTags: typeof SuggestedTags; ThoughtBubble: typeof ThoughtBubble;
    };
  }
}
