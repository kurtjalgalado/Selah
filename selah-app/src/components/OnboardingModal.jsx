import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MusicNotes as Music, Play, CalendarBlank as Calendar, Users, CaretRight as ChevronRight, CaretLeft as ChevronLeft, SignIn as LogIn, UserPlus, ArrowRight } from '@phosphor-icons/react';
import AppLogo from './AppLogo';
import { useBackHandler } from '../utils/backHandler';
import { haptic } from '../utils/haptics';

export default function OnboardingModal({ isOpen, onComplete }) {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);

    // Register back button so native back moves to previous slide or closes onboarding
    useBackHandler(isOpen, () => {
        if (currentSlide > 0) {
            setCurrentSlide(prev => prev - 1);
            return true;
        }
        handleFinish();
        return true;
    });

    if (!isOpen) return null;

    const slides = [
        {
            badge: 'WELCOME TO SELAH',
            icon: Music,
            iconBg: 'bg-accent/20 text-accent border-accent/40',
            title: 'Modern Worship Planning, Effortless Chords',
            description: 'Transpose any worship song to your vocal range with a single tap. Keep your entire church song catalog available offline anywhere.',
            features: [
                '1-Tap Key Transposition (♯ / ♭)',
                'Offline Worship Songbook Library',
                'Dual-Column & Single-Column Chord Sheets'
            ]
        },
        {
            badge: 'LIVE STAGE COMPANION',
            icon: Play,
            iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
            title: 'Perform With Confidence On Stage',
            description: 'A distraction-free stage performance player with smooth auto-scrolling, quick song jumps, and multi-format sheet printing.',
            features: [
                'Smooth Hands-Free Auto-Scroll',
                'Live Stage Setlist Player with Quick Jumps',
                'Adaptable Printouts for Any Paper Size'
            ]
        },
        {
            badge: 'MINISTRY COORDINATION',
            icon: Users,
            iconBg: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
            title: 'Align Your Worship Team & Ministers',
            description: 'Seamlessly schedule worship leaders, vocalists, and band members for upcoming services, and manage song lineups together.',
            features: [
                'Automatic Schedule Generation from Setlists',
                'Band & Vocalist Rostering with Call Times',
                'Cloud Sync & Church Team Collaboration'
            ]
        }
    ];

    const handleFinish = () => {
        haptic('medium');
        try {
            localStorage.setItem('selah_onboarding_completed', 'true');
        } catch (e) {
            // Ignored
        }
        onComplete();
    };

    const handleLogin = () => {
        handleFinish();
        navigate('/login');
    };

    const handleRegister = () => {
        handleFinish();
        navigate('/register');
    };

    const handleNext = () => {
        haptic('light');
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(prev => prev + 1);
        } else {
            handleFinish();
        }
    };

    const slide = slides[currentSlide];
    const SlideIcon = slide.icon;

    return (
        <div className="fixed inset-0 z-50 bg-primary text-textprimary flex flex-col justify-between p-6 sm:p-10 overflow-y-auto animate-fadeIn">
            {/* Top Bar: Logo & Skip button */}
            <header className="flex items-center justify-between w-full max-w-lg mx-auto pt-2 sm:pt-4">
                <AppLogo size="md" showText={true} />
                <button
                    onClick={handleFinish}
                    className="text-xs font-bold text-textmuted hover:text-textprimary px-3 py-2 rounded-xl transition active:scale-95 min-h-[44px] flex items-center"
                >
                    Skip
                </button>
            </header>

            {/* Slide Body */}
            <main className="w-full max-w-lg mx-auto py-8 sm:py-12 flex flex-col items-center text-center space-y-6 flex-1 justify-center">
                {/* Icon Hero Badge */}
                <div className={`w-20 h-20 rounded-3xl border flex items-center justify-center shadow-2xl transition-all duration-300 ${slide.iconBg}`}>
                    <SlideIcon className="w-10 h-10" />
                </div>

                {/* Badge Tag */}
                <span className="px-3 py-1 rounded-full bg-secondary border border-themed text-[11px] font-extrabold uppercase tracking-widest text-accent">
                    {slide.badge}
                </span>

                {/* Title & Subtitle */}
                <div className="space-y-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-textprimary leading-tight">
                        {slide.title}
                    </h1>
                    <p className="text-sm sm:text-base text-textmuted leading-relaxed max-w-md mx-auto">
                        {slide.description}
                    </p>
                </div>

                {/* Feature Highlights */}
                <div className="w-full max-w-sm bg-elevated/70 border border-themed rounded-2xl p-4 text-left space-y-2.5 shadow-lg">
                    {slide.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm text-textprimary">
                            <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0">
                                <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                            <span className="font-medium">{feat}</span>
                        </div>
                    ))}
                </div>

                {/* Pagination Dots */}
                <div className="flex items-center gap-2 pt-2">
                    {slides.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                haptic('light');
                                setCurrentSlide(idx);
                            }}
                            className={`transition-all duration-300 rounded-full min-h-[24px] min-w-[24px] flex items-center justify-center`}
                            aria-label={`Go to slide ${idx + 1}`}
                        >
                            <span className={`block rounded-full transition-all duration-300 ${
                                currentSlide === idx 
                                    ? 'w-8 h-2.5 bg-accent shadow-md shadow-accent/30' 
                                    : 'w-2.5 h-2.5 bg-textmuted/30 hover:bg-textmuted/60'
                            }`} />
                        </button>
                    ))}
                </div>
            </main>

            {/* Bottom Controls / Action Buttons */}
            <footer className="w-full max-w-lg mx-auto pb-4 sm:pb-6 space-y-3">
                {currentSlide < slides.length - 1 ? (
                    <div className="flex items-center gap-3">
                        {currentSlide > 0 && (
                            <button
                                onClick={() => {
                                    haptic('light');
                                    setCurrentSlide(prev => prev - 1);
                                }}
                                className="min-h-[48px] px-4 rounded-2xl bg-secondary border border-themed text-textprimary font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>Back</span>
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="flex-1 min-h-[48px] px-6 rounded-2xl bg-accent text-onaccent font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-accent/25 hover:bg-accent/90 active:scale-95 transition"
                        >
                            <span>Continue</span>
                            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    </div>
                ) : (
                    /* Final Slide: Auth & Entry Options */
                    <div className="space-y-2.5">
                        <button
                            onClick={handleRegister}
                            className="w-full min-h-[48px] px-6 rounded-2xl bg-accent text-onaccent font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-accent/25 hover:bg-accent/90 active:scale-95 transition"
                        >
                            <UserPlus className="w-4 h-4 stroke-[2.5]" />
                            <span>Create Church Account</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2.5">
                            <button
                                onClick={handleLogin}
                                className="min-h-[48px] px-4 rounded-2xl bg-secondary border border-themed text-textprimary font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:border-accent/40 active:scale-95 transition"
                            >
                                <LogIn className="w-4 h-4 text-accent" />
                                <span>Sign In</span>
                            </button>
                            <button
                                onClick={handleFinish}
                                className="min-h-[48px] px-4 rounded-2xl bg-secondary border border-themed text-textmuted hover:text-textprimary font-semibold text-xs sm:text-sm flex items-center justify-center active:scale-95 transition"
                            >
                                <span>Explore as Guest</span>
                            </button>
                        </div>
                    </div>
                )}
            </footer>
        </div>
    );
}
