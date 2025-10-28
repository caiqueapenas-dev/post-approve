import { useState, useRef, useEffect } from 'react';
import { PostImage } from '../lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PostCarouselProps = {
  images: PostImage[];
};

export const PostCarousel = ({ images }: PostCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sortedImages = [...images].sort((a, b) => a.position - b.position);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const threshold = 50;

    if (distance > threshold && currentIndex < sortedImages.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }

    if (distance < -threshold && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: currentIndex * scrollRef.current.clientWidth,
        behavior: 'smooth',
      });
    }
  }, [currentIndex]);

  if (sortedImages.length === 1) {
    return (
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        <img
          src={sortedImages[0].image_url}
          alt="Post"
          className="w-full h-auto"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {sortedImages.map((image) => (
          <div
            key={image.id}
            className="w-full flex-shrink-0 snap-center bg-black"
          >
            <img
              src={image.image_url}
              alt={`Slide ${image.position + 1}`}
              className="w-full h-auto"
            />
          </div>
        ))}
      </div>

      {sortedImages.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-100 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-gray-900" />
          </button>

          <button
            onClick={() => setCurrentIndex(Math.min(sortedImages.length - 1, currentIndex + 1))}
            disabled={currentIndex === sortedImages.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-100 transition-all"
          >
            <ChevronRight className="w-5 h-5 text-gray-900" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {sortedImages.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-6 bg-white'
                    : 'w-1.5 bg-white bg-opacity-50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
