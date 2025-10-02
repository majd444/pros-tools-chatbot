import React from 'react';
import Image from 'next/image';

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
  _profileImage: string;
  className?: string;
}

export const SimpleChatForm: React.FC<SimpleChatFormProps> = ({
  formFields,
  onFormSubmitAction,
  _assistantName,
  _welcomeMessage,
  _headerColor,
  _accentColor,
  _profileImage,
  className = ''
}) => {
  const [formData, setFormData] = React.useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFormSubmitAction(formData);
  };

  return (
    <div className={`flex flex-col h-full ${className} bg-white`}>
      {/* Chat Header */}
      <div className="p-4 flex items-center justify-between border-b" style={{ backgroundColor: _headerColor }}>
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-gray-300 mr-3 flex items-center justify-center text-white">
            {_assistantName.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-lg font-semibold text-white">{_assistantName}</h2>
        </div>
        <button className="text-white hover:bg-white/20 p-2 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Chat Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-start mb-4">
          {_profileImage ? (
            <Image 
              src={_profileImage} 
              alt={_assistantName} 
              width={40}
              height={40}
              className="rounded-full mr-3"
            />
          ) : (
            <div 
              className="w-10 h-10 rounded-full mr-3 flex items-center justify-center text-white"
              style={{ backgroundColor: _accentColor }}
            >
              {_assistantName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="max-w-[80%] p-3 rounded-lg bg-gray-100 text-gray-800">
            <p className="text-sm">{_welcomeMessage}</p>
            <p className="text-xs opacity-70 mt-1">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t">
        {formFields.map(field => (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={field.id}
                name={field.id}
                value={formData[field.id] || ''}
                onChange={handleChange}
                className="w-full p-2 border rounded-md"
                required={field.required}
                rows={3}
              />
            ) : (
              <input
                type={field.type}
                id={field.id}
                name={field.id}
                value={formData[field.id] || ''}
                onChange={handleChange}
                className="w-full p-2 border rounded-md"
                required={field.required}
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          className="w-full py-2 px-4 rounded-md text-white"
          style={{ backgroundColor: _accentColor }}
        >
          Submit
        </button>
      </form>
    </div>
  );
};

export default SimpleChatForm;
