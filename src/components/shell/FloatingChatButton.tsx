"use client"

import { MessageSquare, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useChatOverlay } from "./shell-context"
import { AIInteractable } from "@/components/ai/AIInteractable"

/**
 * FloatingChatButton Komponente (FAB)
 *
 * Floating Action Button für den KI-Chat.
 * Positioniert unten rechts, transformiert zwischen Chat-Icon und X-Icon.
 *
 * @example
 * ```tsx
 * <FloatingChatButton />
 * ```
 */
export function FloatingChatButton(): React.ReactElement {
  const { isOpen, toggle } = useChatOverlay()

  return (
    <div className="fixed right-6 bottom-6 z-50">
      <AIInteractable
        id="floating-chat-button"
        action="toggle"
        target="chat-overlay"
        description="Öffnet oder schließt den KI-Chat"
        keywords={["chat", "ki", "ai", "assistent", "hilfe", "help", "assist", "overlay"]}
        category="layout"
      >
        <Button
          onClick={toggle}
          size="icon"
          className={cn(
            "size-14 rounded-full shadow-lg transition-all",
            "hover:scale-110 hover:shadow-xl",
            isOpen && "bg-destructive hover:bg-destructive/90"
          )}
        >
          {isOpen ? (
            <X className="size-6 transition-transform" />
          ) : (
            <MessageSquare className="size-6 transition-transform" />
          )}
        </Button>
      </AIInteractable>
    </div>
  )
}
