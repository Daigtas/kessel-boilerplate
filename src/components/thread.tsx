import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/attachment"
import { MarkdownText } from "@/components/markdown-text"
import { ToolFallback } from "@/components/tool-fallback"
import { TooltipIconButton } from "@/components/tooltip-icon-button"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
} from "lucide-react"
import type { FC } from "react"

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container flex h-full flex-col bg-transparent"
      style={{
        ["--thread-max-width" as string]: "44rem",
      }}
    >
      {/* Scrollbarer Bereich für Messages - nimmt verfügbaren Platz ein */}
      <ThreadPrimitive.Viewport
        turnAnchor="end"
        className="aui-thread-viewport min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 pt-4"
      >
        <ThreadPrimitive.If empty>
          <ThreadWelcome />
        </ThreadPrimitive.If>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            EditComposer,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      {/* Composer AUSSERHALB des Viewports - bleibt immer am unteren Rand */}
      <div className="aui-thread-viewport-footer bg-muted relative mx-auto flex w-full max-w-(--thread-max-width) shrink-0 flex-col gap-4 rounded-t-xl px-4 pt-2 pb-4 md:pb-6">
        <ThreadScrollToBottom />
        <Composer />
      </div>
    </ThreadPrimitive.Root>
  )
}

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Nach unten scrollen"
        variant="outline"
        className="aui-thread-scroll-to-bottom dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  )
}

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in text-2xl font-semibold duration-200">
            Hallo!
          </h1>
          <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in text-muted-foreground text-xl delay-75 duration-200">
            Wie kann ich dir helfen?
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  )
}

const SUGGESTIONS = [
  {
    title: "Was kann ich hier machen?",
    label: "Erkläre mir die App",
    prompt: "Was kann ich in dieser App alles machen?",
  },
  {
    title: "Wie navigiere ich?",
    label: "durch die Anwendung",
    prompt: "Wie navigiere ich durch die Anwendung?",
  },
] as const

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions flex w-full flex-col gap-2 pb-4">
      {SUGGESTIONS.map((suggestion, index) => (
        <div
          key={suggestion.prompt}
          className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200"
          style={{ animationDelay: `${100 + index * 50}ms` }}
        >
          <ThreadPrimitive.Suggestion prompt={suggestion.prompt} send asChild>
            <Button
              variant="ghost"
              className="aui-thread-welcome-suggestion border-input bg-card hover:bg-card/80 h-auto w-full flex-col items-start justify-start gap-1 rounded-lg border px-4 py-3 text-left text-sm transition-colors"
              aria-label={suggestion.prompt}
            >
              <span className="aui-thread-welcome-suggestion-text-1 font-medium">
                {suggestion.title}
              </span>
              <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
                {suggestion.label}
              </span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </div>
      ))}
    </div>
  )
}

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone className="aui-composer-attachment-dropzone border-input bg-card has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:bg-accent/50 flex w-full flex-col rounded-lg border px-1 pt-2 shadow-xl outline-none has-[textarea:focus-visible]:ring-2 data-[dragging=true]:border-dashed">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Nachricht eingeben..."
          className="aui-composer-input placeholder:text-muted-foreground mb-1 max-h-32 min-h-14 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm outline-none focus-visible:ring-0"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction />
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  )
}

const ComposerAction: FC = () => {
  return (
    <div className="aui-composer-action-wrapper relative mx-2 mb-2 flex items-center justify-between">
      <ComposerAddAttachment />

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Nachricht senden"
            side="bottom"
            type="submit"
            variant="default"
            size="icon"
            className="aui-composer-send size-8 rounded-full"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-4" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-8 rounded-full"
            aria-label="Generierung stoppen"
          >
            <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  )
}

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <div className="aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 dark:text-destructive/80 mt-2 rounded-md border p-3 text-sm">
        Ein Fehler ist aufgetreten. Bitte versuche es erneut.
      </div>
    </MessagePrimitive.Error>
  )
}

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-assistant-message-root fade-in slide-in-from-bottom-1 animate-in relative mx-auto w-full max-w-(--thread-max-width) py-3 duration-150"
      data-role="assistant"
    >
      <div className="aui-assistant-message-content text-foreground px-2 leading-relaxed wrap-break-word">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolFallback },
          }}
        />
        <MessageError />
      </div>

      <div className="aui-assistant-message-footer mt-1 ml-2 flex">
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  )
}

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root text-muted-foreground data-floating:bg-background col-start-3 row-start-2 -ml-1 flex gap-1 data-floating:absolute data-floating:rounded-md data-floating:border data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Kopieren">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Neu generieren">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  )
}

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 animate-in mx-auto grid w-full max-w-(--thread-max-width) auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 duration-150 [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content bg-muted text-foreground rounded-xl px-4 py-2.5 wrap-break-word">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  )
}

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Bearbeiten" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  )
}

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-3">
      <ComposerPrimitive.Root className="aui-edit-composer-root bg-muted ml-auto flex w-5/6 flex-col rounded-xl">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent p-4 text-sm outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Abbrechen
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Aktualisieren</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root text-muted-foreground mr-2 -ml-2 inline-flex items-center text-xs",
        className
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Vorherige">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Nächste">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}
