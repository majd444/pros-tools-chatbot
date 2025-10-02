declare module '@/components/simple-chat-form' {
  import { FC } from 'react';
  
  interface SimpleChatFormProps {
    formFields: Array<{
      id: string;
      label: string;
      type: string;
      required: boolean;
      value?: string;
    }>;
    onFormSubmitAction: (formData: Record<string, string>) => void;
    _assistantName: string;
    _welcomeMessage: string;
    _headerColor: string;
    _accentColor: string;
    _backgroundColor: string;
    _profileImage: string;
    className?: string;
  }

  const SimpleChatForm: FC<SimpleChatFormProps>;
  export default SimpleChatForm;
}

declare module '@/components/chat-interface' {
  import { FC } from 'react';
  
  interface Message {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
  }

  interface ChatInterfaceProps {
    assistantName: string;
    profileImage?: string;
    welcomeMessage: string;
    headerColor: string;
    accentColor: string;
    onSendMessage: (message: string) => void;
    onClose: () => void;
    className?: string;
  }

  const ChatInterface: FC<ChatInterfaceProps>;
  export default ChatInterface;
}
