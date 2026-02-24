import { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileAttachment {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'video' | 'document' | 'code' | 'data';
}

interface FileInputProps {
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  disabled?: boolean;
}

const SUPPORTED_FILE_TYPES = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.tif'],
  video: ['.mp4', '.mov', '.webm', '.avi'],
  document: ['.pdf', '.docx', '.doc', '.txt', '.md'],
  code: ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rb', '.php', '.html', '.css', '.json', '.xml', '.yaml', '.yml'],
  data: ['.json', '.csv', '.xml', '.yaml', '.yml'],
};

const MIME_TYPES = [
  'image/*',
  'video/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/*',
  'application/json',
  'application/xml',
  'text/csv',
  'text/yaml',
  'text/x-yaml',
].join(',');

const ALL_SUPPORTED_TYPES = Object.values(SUPPORTED_FILE_TYPES).flat().join(',');

const getFileType = (file: File): FileAttachment['type'] => {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  
  if (SUPPORTED_FILE_TYPES.image.includes(ext)) return 'image';
  if (SUPPORTED_FILE_TYPES.video.includes(ext)) return 'video';
  if (SUPPORTED_FILE_TYPES.document.includes(ext)) return 'document';
  if (SUPPORTED_FILE_TYPES.data.includes(ext)) return 'data';
  if (SUPPORTED_FILE_TYPES.code.includes(ext)) return 'code';
  
  return 'document';
};

export function FileInput({ attachments, onAttachmentsChange, disabled }: FileInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newAttachments: FileAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = getFileType(file);
      
      const attachment: FileAttachment = {
        id: `${Date.now()}-${i}`,
        file,
        type,
      };

      if (type === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string;
          onAttachmentsChange([...attachments, ...newAttachments.filter(a => a.id !== attachment.id), attachment]);
        };
        reader.readAsDataURL(file);
      }

      newAttachments.push(attachment);
    }

    onAttachmentsChange([...attachments, ...newAttachments]);
  };

  const handleRemove = (id: string) => {
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={MIME_TYPES}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className={cn(
          'p-2 rounded-lg transition-colors',
          'hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed',
          'text-slate-400 hover:text-slate-200'
        )}
        title="Attach files (images, documents, videos, code)"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg text-sm"
            >
              {attachment.preview && (
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="w-6 h-6 object-cover rounded"
                />
              )}
              <span className="text-slate-300 max-w-[200px] truncate">
                {attachment.file.name}
              </span>
              <button
                onClick={() => handleRemove(attachment.id)}
                className="text-slate-400 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
