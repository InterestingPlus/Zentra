import React, { useEffect, useState } from 'react';
import type { Book } from '../types/zentra';

interface BookCoverProps {
  book: Book;
  authorName: string;
  progressPercent?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const BookCover: React.FC<BookCoverProps> = ({
  book,
  authorName,
  progressPercent,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [book.coverUrl]);

  const showImage = Boolean(book.coverUrl) && !imgError;

  const accent = book.coverAccent || '#1E3A8A';

  const sizeClasses = {
    sm: 'w-14 aspect-[3/4] rounded-lg',
    md: 'w-full aspect-[3/4] rounded-xl',
    lg: 'w-44 sm:w-52 aspect-[3/4] rounded-xl',
    xl: 'w-48 sm:w-60 aspect-[3/4] rounded-2xl',
  }[size];

  const titleSizeClass =
    size === 'sm'
      ? 'text-[9px] leading-tight'
      : size === 'md'
        ? 'text-sm leading-snug'
        : 'text-lg leading-snug';

  return (
    <div
      className={`relative overflow-hidden book-cover-shadow bg-slate-900 select-none ${sizeClasses} ${className}`}
    >
      {showImage ? (
        <img
          src={book.coverUrl}
          alt={`Cover of ${book.title}`}
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (
              book.coverUrl.includes('books.google.com') &&
              img.naturalWidth === 128 &&
              img.naturalHeight === 170
            ) {
              setImgError(true);
            }
          }}
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="h-full w-full flex flex-col justify-between p-3 sm:p-4 text-white relative"
          style={{
            background: `linear-gradient(155deg, ${accent} 0%, #0F172A 100%)`,
          }}
        >
          {/* Subtle cloth spine line */}
          <div className="absolute inset-y-0 left-2 w-px bg-white/15" aria-hidden="true" />
          <div className="pl-2">
            {size !== 'sm' && (
              <p className="text-[10px] tracking-widest uppercase text-white/70 truncate">
                {book.category}
              </p>
            )}
          </div>
          <div className="pl-2 my-auto">
            <h4 className={`font-display font-semibold text-white line-clamp-3 ${titleSizeClass}`}>
              {book.title}
            </h4>
            {size !== 'sm' && (
              <p className="mt-1.5 text-[11px] text-white/75 truncate">{authorName}</p>
            )}
          </div>
          <div className="pl-2 flex items-center justify-between border-t border-white/15 pt-1.5">
            {size !== 'sm' && (
              <span className="text-[10px] font-mono-tabular text-white/60">ZENTRA</span>
            )}
          </div>
        </div>
      )}

      {typeof progressPercent === 'number' && progressPercent > 0 && (
        <div
          className="absolute inset-x-0 bottom-0 h-1 bg-black/35"
          aria-label={`Reading progress ${progressPercent}%`}
        >
          <div
            className="h-full bg-blue-400 transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(2, progressPercent))}%` }}
          />
        </div>
      )}
    </div>
  );
};
