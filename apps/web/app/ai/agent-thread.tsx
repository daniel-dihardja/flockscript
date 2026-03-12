"use client";

import type { PromptInputMessage } from "@workspace/ui/components/ai-elements/prompt-input";

import type { AttachmentData } from "@workspace/ui/components/ai-elements/attachments";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@workspace/ui/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@workspace/ui/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@workspace/ui/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@workspace/ui/components/ai-elements/prompt-input";

import { Spinner } from "@workspace/ui/components/spinner";
import { useCallback, useMemo, useState } from "react";

interface MessageType {
  key: string;
  from: "user" | "assistant";
  content: string;
}

const AttachmentItem = ({
  attachment,
  onRemove,
}: {
  attachment: AttachmentData;
  onRemove: (id: string) => void;
}) => {
  const handleRemove = useCallback(() => {
    onRemove(attachment.id);
  }, [onRemove, attachment.id]);

  return (
    <Attachment data={attachment} onRemove={handleRemove}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  );
};

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => {
      attachments.remove(id);
    },
    [attachments],
  );

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <AttachmentItem
          attachment={attachment}
          key={attachment.id}
          onRemove={handleRemove}
        />
      ))}
    </Attachments>
  );
};

export const AgentThread = () => {
  const [text, setText] = useState<string>("");
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");
  const [messages, setMessages] = useState<MessageType[]>([]);

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const hasText = Boolean(message.text);
      const hasAttachments = Boolean(message.files?.length);

      if (!(hasText || hasAttachments)) {
        return;
      }

      const userContent = message.text || "Sent with attachments";
      const userMessage: MessageType = {
        key: `user-${Date.now()}`,
        from: "user",
        content: userContent,
      };

      setMessages((prev) => [...prev, userMessage]);
      setText("");
      setStatus("submitted");

      const uiMessages = [...messages, userMessage].map((m) => ({
        id: m.key,
        role: m.from === "user" ? ("user" as const) : ("assistant" as const),
        parts: [{ type: "text" as const, text: m.content }],
      }));

      try {
        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: uiMessages }),
        });

        if (!res.ok) {
          setStatus("error");
          return;
        }

        const data = (await res.json()) as { content: string };
        setMessages((prev) => [
          ...prev,
          {
            key: `assistant-${Date.now()}`,
            from: "assistant",
            content: data.content ?? "",
          },
        ]);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [messages],
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    [],
  );

  const isSubmitDisabled = useMemo(
    () => !text.trim() || status === "streaming",
    [text, status],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Conversation>
        <ConversationContent>
          {messages.map((message) => (
            <Message from={message.from} key={message.key}>
              <MessageContent>
                <MessageResponse>{message.content}</MessageResponse>
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <Message from="assistant">
              <Spinner />
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="w-full px-4 pb-4 pt-4">
        <PromptInput globalDrop multiple onSubmit={handleSubmit}>
          <PromptInputHeader>
            <PromptInputAttachmentsDisplay />
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea onChange={handleTextChange} value={text} />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit disabled={isSubmitDisabled} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};
