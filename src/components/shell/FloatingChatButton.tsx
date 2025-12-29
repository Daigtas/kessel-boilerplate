"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { useChatOverlay } from "./shell-context"
import { useAuth } from "@/components/auth"
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
  const { user } = useAuth()

  // Chatbot-Avatar Seed: Gespeicherter Seed oder Fallback
  const chatbotAvatarSeed = user?.chatbotAvatarSeed || user?.email || "default"

  // DiceBear "bottts" URL für Robot-Avatar
  const chatbotAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(chatbotAvatarSeed)}`

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
            "relative size-14 rounded-full bg-transparent p-0 shadow-lg transition-all",
            "hover:scale-110 hover:bg-transparent hover:shadow-xl"
          )}
        >
          {/* Avatar ist immer sichtbar */}
          <Avatar className="size-12">
            <AvatarImage src={chatbotAvatarUrl} alt="Chatbot" />
          </Avatar>
          {/* X-Overlay wenn Chat offen */}
          {isOpen && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
              <X className="text-destructive size-6" />
            </div>
          )}
        </Button>
      </AIInteractable>
    </div>
  )
}
