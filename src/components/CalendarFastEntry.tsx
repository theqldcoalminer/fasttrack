import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Calendar, Clock, Plus, Play, Pause, Square, Timer, Edit3 } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { apiService } from '../services/apiService';
import 'react-day-picker/dist/style.css';

interface CalendarFastEntryProps {
  onAddFast: (startTime: Date, endTime: Date, notes?: string) => void;
  theme: string;
  userId: string;
}

export function CalendarFastEntry({ onAddFast, theme, userId }: CalendarFastEntryProps) {
  // Manual entry state
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startHour, setStartHour] = useState(20);
  const [endHour, setEndHour] = useState(12);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);

  // Live timer state
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [timerNotes, setTimerNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load timer state from backend on mount
  useEffect(() => {
    loadTimerFromBackend();
  }, [userId]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTimerActive && timerStartTime && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds(differenceInSeconds(new Date(), timerStartTime));
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isTimerActive, timerStartTime, isPaused]);

  const loadTimerFromBackend = async () => {
    try {
      setIsLoading(true);
      const timerData = await apiService.getTimer(userId);
      
      if (timerData) {
        const startTime = new Date(timerData.startTime);
        setTimerStartTime(startTime);
        setIsTimerActive(true);
        setIsPaused(timerData.isPaused);
        setTimerNotes(timerData.notes || '');
        
        if (!timerData.isPaused) {
          setElapsedSeconds(differenceInSeconds(new Date(), startTime));
        } else if (timerData.pausedAt) {
          setElapsedSeconds(differenceInSeconds(new Date(timerData.pausedAt), startTime));
        }
        
        console.log('🔄 Timer state loaded from backend');
      }
    } catch (error) {
      console.error('Failed to load timer from backend:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const formatTimerDisplay = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateDuration = () => {
    const start = new Date(startDate);
    start.setHours(startHour, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(endHour, 0, 0, 0);
    
    // Handle overnight fasts: if end time is earlier than start time on the same day,
    // assume the fast continues to the next day
    if (startDate.toDateString() === endDate.toDateString() && endHour < startHour) {
      end.setDate(end.getDate() + 1);
    }
    
    if (end <= start) {
      return 0;
    }
    
    const hours = differenceInHours(end, start);
    const minutes = differenceInMinutes(end, start) % 60;
    
    return { hours, minutes, total: hours + minutes / 60 };
  };

  const duration = calculateDuration();

  // Timer functions
  const handleStartTimer = async () => {
    try {
      setIsLoading(true);
      const now = new Date();
      
      await apiService.startTimer(userId, now, timerNotes);
      
      setTimerStartTime(now);
      setIsTimerActive(true);
      setIsPaused(false);
      setElapsedSeconds(0);
      
      console.log('⏱️ Timer started and saved to backend');
    } catch (error) {
      console.error('Failed to start timer:', error);
      alert('Failed to start timer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseTimer = async () => {
    try {
      setIsLoading(true);
      const pausedAt = new Date();
      
      await apiService.updateTimer(userId, {
        isPaused: true,
        pausedAt: pausedAt.toISOString(),
        notes: timerNotes
      });
      
      setIsPaused(true);
      console.log('⏸️ Timer paused and saved to backend');
    } catch (error) {
      console.error('Failed to pause timer:', error);
      alert('Failed to pause timer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeTimer = async () => {
    try {
      setIsLoading(true);
      
      await apiService.updateTimer(userId, {
        isPaused: false,
        pausedAt: null,
        notes: timerNotes
      });
      
      setIsPaused(false);
      console.log('▶️ Timer resumed and saved to backend');
    } catch (error) {
      console.error('Failed to resume timer:', error);
      alert('Failed to resume timer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopTimer = async () => {
    if (timerStartTime) {
      try {
        setIsLoading(true);
        const endTime = new Date();
        
        // Save the fast
        await onAddFast(timerStartTime, endTime, timerNotes);
        
        // Delete timer from backend
        await apiService.deleteTimer(userId);
        
        // Reset timer state
        setIsTimerActive(false);
        setTimerStartTime(null);
        setElapsedSeconds(0);
        setIsPaused(false);
        setTimerNotes('');
        
        console.log('⏹️ Timer stopped and fast saved');
      } catch (error) {
        console.error('Failed to stop timer:', error);
        alert('Failed to stop timer. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUpdateTimerNotes = async (newNotes: string) => {
    setTimerNotes(newNotes);
    
    if (isTimerActive) {
      try {
        await apiService.updateTimer(userId, { notes: newNotes });
      } catch (error) {
        console.error('Failed to update timer notes:', error);
      }
    }
  };

  // Manual entry submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const start = new Date(startDate);
    start.setHours(startHour, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(endHour, 0, 0, 0);
    
    // Handle overnight fasts: if end time is earlier than start time on the same day,
    // assume the fast continues to the next day
    if (startDate.toDateString() === endDate.toDateString() && endHour < startHour) {
      end.setDate(end.getDate() + 1);
    }
    
    if (end <= start) {
      alert('End time must be after start time');
      return;
    }
    
    onAddFast(start, end, notes);
    
    // Reset to defaults
    setStartDate(new Date());
    setEndDate(new Date());
    setStartHour(20);
    setEndHour(12);
    setNotes('');
  };

  const themeClasses = {
    blue: 'from-blue-50 to-indigo-100 border-blue-200',
    purple: 'from-purple-50 to-violet-100 border-purple-200',
    green: 'from-green-50 to-emerald-100 border-green-200',
    orange: 'from-orange-50 to-amber-100 border-orange-200',
    pink: 'from-pink-50 to-rose-100 border-pink-200',
    teal: 'from-teal-50 to-cyan-100 border-teal-200',
    dark: 'from-gray-800 to-gray-900 border-gray-700',
    midnight: 'from-slate-900 to-black border-slate-700'
  };

  const sectionClasses = {
    blue: 'bg-blue-50/80 border-blue-200',
    purple: 'bg-purple-50/80 border-purple-200',
    green: 'bg-green-50/80 border-green-200',
    orange: 'bg-orange-50/80 border-orange-200',
    pink: 'bg-pink-50/80 border-pink-200',
    teal: 'bg-teal-50/80 border-teal-200',
    dark: 'bg-gray-700/80 border-gray-600 text-white',
    midnight: 'bg-slate-800/80 border-slate-600 text-white'
  };

  const iconColors = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    pink: 'text-pink-600',
    teal: 'text-teal-600',
    dark: 'text-gray-300',
    midnight: 'text-slate-300'
  };

  const isDarkTheme = theme === 'dark' || theme === 'midnight';

  return (
    <div className="space-y-8">
      {/* Live Fasting Timer */}
      <Card className={`bg-gradient-to-br ${themeClasses[theme as keyof typeof themeClasses]}`}>
        <CardContent>
          <div className="flex items-center mb-6">
            <Timer className={`w-6 h-6 ${iconColors[theme as keyof typeof iconColors]} mr-3`} />
            <h3 className={`text-xl font-bold ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Live Fasting Timer</h3>
            {isLoading && (
              <div className={`ml-auto text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                Syncing...
              </div>
            )}
          </div>

          <div className={`rounded-xl p-8 shadow-sm border ${sectionClasses[theme as keyof typeof sectionClasses]} text-center`}>
            {!isTimerActive ? (
              <div>
                <div className={`text-6xl font-mono font-bold mb-4 ${iconColors[theme as keyof typeof iconColors]}`}>
                  00:00:00
                </div>
                <p className={`mb-6 ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                  Start your fast now and track it in real-time across all devices
                </p>
                <Button 
                  onClick={handleStartTimer}
                  disabled={isLoading}
                  className="px-8 py-3 text-lg bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {isLoading ? 'Starting...' : 'Start Fast Now'}
                </Button>
              </div>
            ) : (
              <div>
                <div className={`text-6xl font-mono font-bold mb-2 ${iconColors[theme as keyof typeof iconColors]}`}>
                  {formatTimerDisplay(elapsedSeconds)}
                </div>
                <p className={`mb-6 ${isDarkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                  {timerStartTime && `Started ${format(timerStartTime, 'MMM dd, yyyy \'at\' h:mm a')}`}
                  {isPaused && ' (Paused)'}
                </p>
                
                <div className="flex justify-center space-x-4">
                  {!isPaused ? (
                    <Button 
                      onClick={handlePauseTimer}
                      disabled={isLoading}
                      variant="secondary"
                      className="px-6 py-2"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      {isLoading ? 'Pausing...' : 'Pause'}
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleResumeTimer}
                      disabled={isLoading}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {isLoading ? 'Resuming...' : 'Resume'}
                    </Button>
                  )}
                  
                  <Button 
                    onClick={handleStopTimer}
                    disabled={isLoading}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    {isLoading ? 'Stopping...' : 'Stop Fast'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Notes section for live timer */}
          {isTimerActive && (
            <div className={`mt-6 rounded-xl p-6 shadow-sm border ${sectionClasses[theme as keyof typeof sectionClasses]}`}>
              <div className="flex items-center justify-between mb-4">
                <h4 className={`text-lg font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                  Fast Notes
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotesInput(!showNotesInput)}
                  className={`${isDarkTheme ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
              
              {showNotesInput ? (
                <div>
                  <textarea
                    value={timerNotes}
                    onChange={(e) => handleUpdateTimerNotes(e.target.value)}
                    placeholder="How are you feeling? What's motivating you? Any observations..."
                    className={`w-full h-24 p-3 border rounded-lg resize-none ${
                      isDarkTheme 
                        ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  />
                  <p className={`text-sm mt-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                    Notes are automatically saved and will be included when you stop the fast
                  </p>
                </div>
              ) : (
                <div className={`p-3 rounded-lg ${isDarkTheme ? 'bg-gray-600/50' : 'bg-gray-50'}`}>
                  {timerNotes ? (
                    <p className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      {timerNotes}
                    </p>
                  ) : (
                    <p className={`italic ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                      Click the pen icon to add notes about your fast
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Fast Entry */}
      <Card className={`bg-gradient-to-br ${themeClasses[theme as keyof typeof themeClasses]}`}>
        <CardContent>
          <div className="flex items-center mb-6">
            <Calendar className={`w-6 h-6 ${iconColors[theme as keyof typeof iconColors]} mr-3`} />
            <h3 className={`text-xl font-bold ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Add Past Fast</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Start Date & Time */}
            <div className={`rounded-xl p-6 shadow-sm border ${sectionClasses[theme as keyof typeof sectionClasses]}`}>
              <h4 className={`text-lg font-semibold mb-4 flex items-center ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                <Clock className="w-5 h-5 mr-2 text-green-600" />
                Fast Start
              </h4>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Start Date */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                    Start Date
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowStartCalendar(!showStartCalendar)}
                    className="w-full justify-start text-left"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {format(startDate, 'EEEE, MMMM do, yyyy')}
                  </Button>
                  
                  {showStartCalendar && (
                    <div className={`mt-4 p-4 border rounded-lg shadow-lg absolute z-10 ${isDarkTheme ? 'bg-gray-800 border-gray-600 dark-theme' : 'bg-white border-gray-200'}`}>
                      <DayPicker
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          if (date) {
                            setStartDate(date);
                            setShowStartCalendar(false);
                          }
                        }}
                        className="mx-auto"
                      />
                    </div>
                  )}
                </div>
                
                {/* Start Time */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                    Start Time: {formatTime(startHour)}
                  </label>
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-xs mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Hour: {startHour}</label>
                      <input
                        type="range"
                        min="0"
                        max="23"
                        value={startHour}
                        onChange={(e) => setStartHour(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* End Date & Time */}
            <div className={`rounded-xl p-6 shadow-sm border ${sectionClasses[theme as keyof typeof sectionClasses]}`}>
              <h4 className={`text-lg font-semibold mb-4 flex items-center ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                <Clock className="w-5 h-5 mr-2 text-red-600" />
                Fast End
              </h4>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* End Date */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                    End Date
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEndCalendar(!showEndCalendar)}
                    className="w-full justify-start text-left"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {format(endDate, 'EEEE, MMMM do, yyyy')}
                  </Button>
                  
                  {showEndCalendar && (
                    <div className={`mt-4 p-4 border rounded-lg shadow-lg absolute z-10 ${isDarkTheme ? 'bg-gray-800 border-gray-600 dark-theme' : 'bg-white border-gray-200'}`}>
                      <DayPicker
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          if (date) {
                            setEndDate(date);
                            setShowEndCalendar(false);
                          }
                        }}
                        className="mx-auto"
                      />
                    </div>
                  )}
                </div>
                
                {/* End Time */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                    End Time: {formatTime(endHour)}
                  </label>
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-xs mb-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Hour: {endHour}</label>
                      <input
                        type="range"
                        min="0"
                        max="23"
                        value={endHour}
                        onChange={(e) => setEndHour(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className={`rounded-xl p-6 shadow-sm border ${sectionClasses[theme as keyof typeof sectionClasses]}`}>
              <div className="flex items-center justify-between mb-4">
                <h4 className={`text-lg font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                  Fast Notes (Optional)
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotesInput(!showNotesInput)}
                  className={`${isDarkTheme ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
              
              {showNotesInput ? (
                <div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How did this fast go? Any observations, challenges, or victories..."
                    className={`w-full h-24 p-3 border rounded-lg resize-none ${
                      isDarkTheme 
                        ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  />
                  <p className={`text-sm mt-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                    Add personal notes about your fasting experience
                  </p>
                </div>
              ) : (
                <div className={`p-3 rounded-lg ${isDarkTheme ? 'bg-gray-600/50' : 'bg-gray-50'}`}>
                  {notes ? (
                    <p className={`${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      {notes}
                    </p>
                  ) : (
                    <p className={`italic ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                      Click the pen icon to add notes about your fast
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Duration Preview */}
            <div className={`rounded-xl p-6 border ${sectionClasses[theme as keyof typeof sectionClasses]}`}>
              <h4 className={`text-lg font-semibold mb-2 ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>Fast Duration</h4>
              {duration.total > 0 ? (
                <div className="text-center">
                  <p className={`text-3xl font-bold ${iconColors[theme as keyof typeof iconColors]}`}>
                    {Math.round(duration.total)} hours
                  </p>
                  <p className={`text-sm mt-1 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                    {duration.hours}h {duration.minutes}m exactly
                  </p>
                </div>
              ) : (
                <p className="text-red-500 text-center">Please ensure end time is after start time</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full py-3 text-lg"
              disabled={duration.total <= 0}
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Fast to History
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}