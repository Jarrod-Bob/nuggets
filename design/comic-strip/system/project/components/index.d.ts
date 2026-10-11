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

/** The only button shape. With an href it renders as a link. */
export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** paper (default), tomato for the page's primary action, ink for a selected state, danger (red-ink outline) for what can't be undone. */
  variant?: 'paper' | 'tomato' | 'ink' | 'danger';
  /** lg for the single call to action on a page; sm inside cards, caption boxes and settings sections. */
  size?: 'sm' | 'md' | 'lg';
  /** Render as a link to this address (a deep link that must be a real href). */
  href?: string;
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
  /** Fill. Default 'nugget'; use 'mayo' or 'paper' on a nugget-gold ground; 'error' is paper with a red-ink line (use ActionError). */
  tone?: 'nugget' | 'mayo' | 'paper' | 'error';
  /** The narrator's lead-in, e.g. "Meanwhile, on the tray…". */
  eyebrow?: React.ReactNode;
}
export declare function CaptionBox(props: CaptionBoxProps): React.ReactElement;

/** A dialog panel with a sticker shadow. Presentational: the host owns the overlay, focus trap and Escape. */
export interface DialogProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  /** One line under the title, wired with aria-describedby. */
  description?: React.ReactNode;
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

/** The state of a connection or a queued job. StatusPill is a nugget's status; this is everything else. Children are the word. */
export interface StatePillProps {
  /** ok (pickle) "Connected"/"Sent", off (dashed) "Not connected", wait (raw) "Queued", attention (tomato) "Needs re-sync", error (red-ink line) "Failed"/"Error". */
  tone: 'ok' | 'off' | 'wait' | 'attention' | 'error';
  children: React.ReactNode;
  className?: string;
}
export declare function StatePill(props: StatePillProps): React.ReactElement;

/** A failed action in plain words: a red-ink caption box with role="alert". Renders nothing without a message. */
export interface ActionErrorProps {
  message?: string;
  /** Shows a small "Dismiss" pill when set. */
  onDismiss?: () => void;
  className?: string;
}
export declare function ActionError(props: ActionErrorProps): React.ReactElement | null;

/** Nothing to show, in the narrator's voice: a caption box with a heading, a line of help and one action. */
export interface EmptyStateProps {
  /** The heading; the same words as the Classic look. */
  headline: string;
  body?: string;
  action?: React.ReactNode;
  /** Where we are, in the narrator's voice. Default "Meanwhile…". */
  eyebrow?: React.ReactNode;
  tone?: 'nugget' | 'mayo' | 'paper';
  className?: string;
  style?: React.CSSProperties;
}
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;

/** A binned nugget in the Classic TrashView's shape. */
export interface ArchivedIdea { id: number | string; title: string; tags?: string[]; archivedAt?: string }

/** A binned nugget: greyed, tipped over, with Restore and Purge. Renders an li; put it in a list. */
export interface BinCardProps {
  title: string;
  tags?: string[];
  /** When it was binned, e.g. "2d ago". */
  archivedAt?: string;
  /** Which of the 8 outlines to draw (0–7). */
  shape?: number;
  /** Rotation in degrees, about ±5 to ±8. Default -6. */
  tilt?: number;
  onRestore?: () => void;
  onPurge?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
export declare function BinCard(props: BinCardProps): React.ReactElement;

/** The bin (Trash): binned nuggets as greyed cards, or "Trash is empty". Props follow the Classic TrashView. */
export interface BinProps {
  /** Newest binned first. */
  ideas?: ArchivedIdea[];
  onRestore?: (id: number | string) => void;
  onPurge?: (id: number | string) => void;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Bin(props: BinProps): React.ReactElement;

export type Look = 'classic' | 'comic';
/** The Look picker: Classic and Comic as two sticker tiles in a radio group legended "Look". */
export interface LookPickerProps {
  value: Look;
  onChange?: (look: Look) => void;
  /** Tag the Comic tile "In progress" while some screens fall back to Classic. */
  comicInProgress?: boolean;
  /** A line under the tiles. */
  hint?: React.ReactNode;
  className?: string;
}
export declare function LookPicker(props: LookPickerProps): React.ReactElement;

/** One integration in the Settings dialog. */
export interface SettingsSectionProps {
  /** The integration's name: "spices", "GitHub", "kimi", "Tag suggestions". */
  title: string;
  description?: string;
  /** A StatePill. */
  status?: React.ReactNode;
  /** Mono facts on the right of the status line: address, last sync, queue counts. */
  detail?: React.ReactNode;
  /** Shown as an ActionError without Dismiss. */
  error?: string;
  /** Left of the action row: "Disconnect" as a small danger Pill. */
  dangerAction?: React.ReactNode;
  /** Right of the action row, the commit last. */
  actions?: React.ReactNode;
  /** The Fields and any notes. */
  children?: React.ReactNode;
  className?: string;
}
export declare function SettingsSection(props: SettingsSectionProps): React.ReactElement;

/** Plan with Claude: the prompt in a speech bubble, the ways to send it, and the answer field. Presentational. */
export interface PlanWithClaudeProps {
  /** The full planning prompt. */
  prompt: string;
  /** The claude:// deep link for "Open in Claude Desktop". */
  desktopUrl: string;
  /** The deep link carries trimmed notes. */
  trimmed?: boolean;
  /** The result of the last copy. */
  copyNote?: string;
  answer?: string;
  onAnswerChange?: (answer: string) => void;
  onCopy?: () => void;
  onCopyAndOpen?: () => void;
  onSave?: () => void;
  saving?: boolean;
  saveError?: string;
  onClose?: () => void;
  className?: string;
}
export declare function PlanWithClaude(props: PlanWithClaudeProps): React.ReactElement;

/** A drawn nugget, as the Classic RandomNugget's RandomIdea plus an optional status for its fill. */
export interface RandomIdea { id?: number; title: string; notes?: string; tags?: string[]; status?: NuggetStatus }
/** Draw a nugget's result: the drawn card with a PICK ME stamp, and the dealt challenge. Presentational. */
export interface RandomNuggetProps {
  /** null: nothing to draw. */
  idea?: RandomIdea | null;
  loading?: boolean;
  /** The tag the draw was narrowed to. */
  tag?: string | null;
  /** The timebox's label, e.g. "One evening". */
  timebox?: string;
  /** The track as its display label. */
  stack?: { language: string; framework: string; track?: string };
  /** Where the stack weights come from. */
  source?: { label: string; url: string; retrieved?: string };
  onReroll?: () => void;
  onRerollTimebox?: () => void;
  onRerollStack?: () => void;
  onClose?: () => void;
  className?: string;
}
export declare function RandomNugget(props: RandomNuggetProps): React.ReactElement;

/** A GitHub feature request, as the API sends it. */
export interface FeatureRequest { id: number; repo: string; state: 'pending' | 'sending' | 'created' | 'failed'; number?: number; url?: string; last_error?: string }
/** A nugget's feature requests as a strip of small panels. Renders nothing when empty. */
export interface FeatureRequestsProps {
  requests: FeatureRequest[];
  onRetry?: (id: number) => void;
  /** The request whose Retry is in flight. */
  retrying?: number | null;
  className?: string;
}
export declare function FeatureRequests(props: FeatureRequestsProps): React.ReactElement | null;

declare global {
  interface Window {
    Comic: {
      Panel: typeof Panel; Strip: typeof Strip; Pill: typeof Pill; Chip: typeof Chip; SearchField: typeof SearchField;
      StatusPill: typeof StatusPill; NuggetCard: typeof NuggetCard; NuggetMark: typeof NuggetMark;
      SpeechBubble: typeof SpeechBubble; Sfx: typeof Sfx; Burst: typeof Burst;
      CaptionBox: typeof CaptionBox; Dialog: typeof Dialog; Field: typeof Field; NameSuggestions: typeof NameSuggestions;
      SuggestedTags: typeof SuggestedTags; ThoughtBubble: typeof ThoughtBubble;
      StatePill: typeof StatePill; ActionError: typeof ActionError; EmptyState: typeof EmptyState; BinCard: typeof BinCard; Bin: typeof Bin;
      LookPicker: typeof LookPicker; SettingsSection: typeof SettingsSection; PlanWithClaude: typeof PlanWithClaude;
      RandomNugget: typeof RandomNugget; FeatureRequests: typeof FeatureRequests;
    };
  }
}
