"use client"

import { type ReactNode } from "react"
import { ShoppingCart, Send } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent } from "@/components/ui/tabs"

import { useAssist, type AssistPanelType } from "./shell-context"
import { AIChatPanel } from "./AIChatPanel"

/**
 * AssistPanel Props
 */
interface AssistPanelProps {
  /** Zusätzliche CSS-Klassen */
  className?: string
  /** Custom Chat Content */
  chatContent?: ReactNode
  /** Custom Wiki Content */
  wikiContent?: ReactNode
  /** Custom Comments Content */
  commentsContent?: ReactNode
  /** Custom Cart Content */
  cartContent?: ReactNode
}

/**
 * AssistPanel Komponente
 *
 * Spalte 4 des 4-Spalten-Layouts (Squeeze-Modus).
 * Tabbed Interface für verschiedene Assist-Funktionen:
 * - Chat: AI-Chat für Hilfe
 * - Wiki: Kontextbezogene Dokumentation
 * - Comments: Kommentare/Diskussionen
 * - Cart: Warenkorb (optional)
 *
 * @example
 * ```tsx
 * <AssistPanel
 *   chatContent={<CustomChat />}
 *   wikiContent={<WikiSearch />}
 * />
 * ```
 */
export function AssistPanel({
  className,
  chatContent,
  wikiContent,
  commentsContent,
  cartContent,
}: AssistPanelProps): React.ReactElement {
  const { activePanel, setPanel } = useAssist()

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Tabbed Content - gesteuert über FloatingAssistActions */}
      <Tabs
        value={activePanel ?? "chat"}
        onValueChange={(value) => setPanel(value as AssistPanelType)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        {/* Tab Contents */}
        {/* forceMount für Chat: Verhindert Unmounting bei Tab-Wechsel, erhält Chat-State */}
        <TabsContent 
          value="chat" 
          className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          forceMount
        >
          {chatContent ?? <AIChatPanel />}
        </TabsContent>

        <TabsContent value="wiki" className="mt-0 flex-1 overflow-hidden">
          {wikiContent ?? <DefaultWikiContent />}
        </TabsContent>

        <TabsContent value="comments" className="mt-0 flex-1 overflow-hidden">
          {commentsContent ?? <DefaultCommentsContent />}
        </TabsContent>

        <TabsContent value="cart" className="mt-0 flex-1 overflow-hidden">
          {cartContent ?? <DefaultCartContent />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Default Wiki Content
 */
function DefaultWikiContent(): React.ReactElement {
  const articles = [
    { title: "Erste Schritte", description: "Einführung in die App" },
    { title: "Navigation", description: "So navigierst du durch die App" },
    { title: "Einstellungen", description: "Personalisierung und Account" },
    { title: "FAQ", description: "Häufig gestellte Fragen" },
  ]

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-2 p-4">
        <Input placeholder="Wiki durchsuchen..." className="mb-4" />
        {articles.map((article, index) => (
          <Button
            key={index}
            variant="ghost"
            className="h-auto w-full flex-col items-start gap-1 py-3"
          >
            <span className="text-sm font-medium">{article.title}</span>
            <span className="text-muted-foreground text-xs">{article.description}</span>
          </Button>
        ))}
      </div>
    </ScrollArea>
  )
}

/**
 * Default Comments Content
 */
function DefaultCommentsContent(): React.ReactElement {
  const comments = [
    { author: "Max M.", text: "Sehr hilfreich!", time: "vor 2h" },
    { author: "Anna K.", text: "Danke für die Erklärung.", time: "vor 5h" },
  ]

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {comments.map((comment, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{comment.author}</span>
                <span className="text-muted-foreground text-xs">{comment.time}</span>
              </div>
              <p className="text-muted-foreground text-sm">{comment.text}</p>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Comment Input */}
      <div className="border-border border-t p-4">
        <div className="flex gap-2">
          <Input placeholder="Kommentar schreiben..." className="flex-1" />
          <Button size="icon">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Default Cart Content
 */
function DefaultCartContent(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center p-4">
      <ShoppingCart className="text-muted-foreground/50 size-12" />
      <p className="text-muted-foreground mt-4 text-sm">Dein Warenkorb ist leer</p>
      <Button variant="outline" className="mt-4">
        Produkte entdecken
      </Button>
    </div>
  )
}
