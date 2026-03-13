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
import { usePatch } from "./patch-provider";

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
  const { patch, setPatch } = usePatch();
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

      // Append the current patch state so the agent can refine it iteratively
      const currentPatch = patch && patch !== "{}" ? patch : null;
      const lastContent = currentPatch
        ? `${userContent}\n\n[Current patch state:\n${currentPatch}\n]`
        : userContent;

      const uiMessages = [...messages, userMessage].map((m, i, arr) => ({
        id: m.key,
        role: m.from === "user" ? ("user" as const) : ("assistant" as const),
        parts: [
          {
            type: "text" as const,
            text:
              i === arr.length - 1 && m.from === "user"
                ? lastContent
                : m.content,
          },
        ],
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

        const assistantKey = `assistant-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { key: assistantKey, from: "assistant", content: "" },
        ]);
        setStatus("streaming");

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            const msg = JSON.parse(payload) as
              | { type: "token"; token: string }
              | { type: "patch"; data: string };
            if (msg.type === "token") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.key === assistantKey
                    ? { ...m, content: m.content + msg.token }
                    : m,
                ),
              );
            } else if (msg.type === "patch") {
              setPatch(JSON.stringify(JSON.parse(msg.data), null, 2));
            }
          }
        }

        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [messages, patch, setPatch],
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    [],
  );

  const isSubmitDisabled = useMemo(
    () => !text.trim() || status === "submitted" || status === "streaming",
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
