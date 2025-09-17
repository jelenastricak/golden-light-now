import { useState, useEffect } from 'react';
import * as SunCalc from 'suncalc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Sun, Moon, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Location {
  latitude: number;
  longitude: number;
}

interface SunTimes {
  goldenHourStart: Date;
  goldenHourEnd: Date;
  blueHourStart: Date;
  blueHourEnd: Date;
  sunrise: Date;
  sunset: Date;
}

const GoldenHourApp = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [sunTimes, setSunTimes] = useState<SunTimes | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const { toast } = useToast();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Calculate sun times when location changes
  useEffect(() => {
    if (location) {
      const times = SunCalc.getTimes(new Date(), location.latitude, location.longitude);
      
      // Calculate golden hour (30 minutes after sunrise and 30 minutes before sunset)
      const goldenHourMorningStart = times.sunrise;
      const goldenHourMorningEnd = new Date(times.sunrise.getTime() + 30 * 60 * 1000);
      const goldenHourEveningStart = new Date(times.sunset.getTime() - 30 * 60 * 1000);
      const goldenHourEveningEnd = times.sunset;

      // Calculate blue hour (20 minutes before sunrise to sunrise, sunset to 20 minutes after sunset)
      const blueHourMorningStart = new Date(times.sunrise.getTime() - 20 * 60 * 1000);
      const blueHourMorningEnd = times.sunrise;
      const blueHourEveningStart = times.sunset;
      const blueHourEveningEnd = new Date(times.sunset.getTime() + 20 * 60 * 1000);

      setSunTimes({
        goldenHourStart: goldenHourMorningStart,
        goldenHourEnd: goldenHourEveningEnd,
        blueHourStart: blueHourMorningStart,
        blueHourEnd: blueHourEveningEnd,
        sunrise: times.sunrise,
        sunset: times.sunset,
      });
    }
  }, [location]);

  const getCurrentLightingCondition = () => {
    if (!sunTimes) return 'day';
    
    const now = currentTime.getTime();
    const morningGoldenStart = sunTimes.goldenHourStart.getTime();
    const morningGoldenEnd = new Date(sunTimes.goldenHourStart.getTime() + 30 * 60 * 1000).getTime();
    const eveningGoldenStart = new Date(sunTimes.sunset.getTime() - 30 * 60 * 1000).getTime();
    const eveningGoldenEnd = sunTimes.sunset.getTime();
    
    const morningBlueStart = new Date(sunTimes.sunrise.getTime() - 20 * 60 * 1000).getTime();
    const morningBlueEnd = sunTimes.sunrise.getTime();
    const eveningBlueStart = sunTimes.sunset.getTime();
    const eveningBlueEnd = new Date(sunTimes.sunset.getTime() + 20 * 60 * 1000).getTime();

    if ((now >= morningGoldenStart && now <= morningGoldenEnd) ||
        (now >= eveningGoldenStart && now <= eveningGoldenEnd)) {
      return 'golden';
    }
    
    if ((now >= morningBlueStart && now <= morningBlueEnd) ||
        (now >= eveningBlueStart && now <= eveningBlueEnd)) {
      return 'blue';
    }
    
    return 'day';
  };

  const getNextSpecialTime = () => {
    if (!sunTimes) return null;
    
    const now = currentTime.getTime();
    const times = [
      { type: 'Blue Hour (Morning)', time: new Date(sunTimes.sunrise.getTime() - 20 * 60 * 1000) },
      { type: 'Golden Hour (Morning)', time: sunTimes.sunrise },
      { type: 'Golden Hour (Evening)', time: new Date(sunTimes.sunset.getTime() - 30 * 60 * 1000) },
      { type: 'Blue Hour (Evening)', time: sunTimes.sunset },
    ];
    
    // Find next upcoming time
    const upcomingTimes = times.filter(t => t.time.getTime() > now);
    
    if (upcomingTimes.length > 0) {
      return upcomingTimes[0];
    }
    
    // If no times today, get tomorrow's first time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimes = SunCalc.getTimes(tomorrow, location!.latitude, location!.longitude);
    
    return {
      type: 'Blue Hour (Morning)',
      time: new Date(tomorrowTimes.sunrise.getTime() - 20 * 60 * 1000)
    };
  };

  const formatTimeUntil = (targetTime: Date) => {
    const diffMs = targetTime.getTime() - currentTime.getTime();
    
    if (diffMs <= 0) return '00:00:00';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      const newLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setLocation(newLocation);
      
      toast({
        title: "Location found!",
        description: "Golden and blue hour times updated for your location.",
      });
    } catch (error) {
      console.error('Error getting location:', error);
      toast({
        title: "Location Error",
        description: "Unable to get your location. Please check your browser settings.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const lightingCondition = getCurrentLightingCondition();
  const nextTime = getNextSpecialTime();

  return (
    <div className={`min-h-screen transition-all duration-1000 ${
      lightingCondition === 'golden' ? 'bg-gradient-golden' :
      lightingCondition === 'blue' ? 'bg-gradient-blue' :
      'bg-gradient-sunset'
    }`}>
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-light tracking-wide text-white mb-4">
            Golden Hour
          </h1>
          <p className="text-xl md:text-2xl text-white/80 font-light">
            Perfect light awaits
          </p>
        </div>

        {/* Main Content */}
        <div className="w-full max-w-md space-y-6">
          
          {!location ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20 p-8 text-center">
              <div className="space-y-6">
                <div className="text-white/80">
                  <MapPin className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-lg font-light">
                    Enable location to see your golden and blue hour times
                  </p>
                </div>
                <Button
                  onClick={getCurrentLocation}
                  disabled={isLoadingLocation}
                  className="w-full bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm"
                >
                  {isLoadingLocation ? (
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4 mr-2" />
                  )}
                  {isLoadingLocation ? 'Getting Location...' : 'Get Location'}
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {/* Current Time */}
              <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 text-center">
                <div className="text-white">
                  <div className="text-4xl font-light mb-2">
                    {currentTime.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                  <div className="text-white/70 capitalize">
                    {lightingCondition === 'golden' && (
                      <div className="flex items-center justify-center">
                        <Sun className="w-4 h-4 mr-2" />
                        Golden Hour
                      </div>
                    )}
                    {lightingCondition === 'blue' && (
                      <div className="flex items-center justify-center">
                        <Moon className="w-4 h-4 mr-2" />
                        Blue Hour
                      </div>
                    )}
                    {lightingCondition === 'day' && 'Daylight'}
                  </div>
                </div>
              </Card>

              {/* Countdown */}
              {nextTime && (
                <Card className="bg-white/10 backdrop-blur-md border-white/20 p-8 text-center">
                  <div className="text-white space-y-4">
                    <div className="text-white/70 text-sm uppercase tracking-wide">
                      Next {nextTime.type}
                    </div>
                    <div className="text-5xl font-light tracking-wider">
                      {formatTimeUntil(nextTime.time)}
                    </div>
                    <div className="text-white/70 text-sm">
                      {nextTime.time.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </Card>
              )}

              {/* Today's Times */}
              {sunTimes && (
                <Card className="bg-white/5 backdrop-blur-md border-white/10 p-6">
                  <div className="text-white space-y-3">
                    <h3 className="text-lg font-light mb-4 text-center">Today's Schedule</h3>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-white/70 mb-1">Sunrise</div>
                        <div className="font-light">
                          {sunTimes.sunrise.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-white/70 mb-1">Sunset</div>
                        <div className="font-light">
                          {sunTimes.sunset.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Reset Location */}
              <Button
                onClick={getCurrentLocation}
                variant="ghost"
                className="w-full text-white/70 hover:text-white hover:bg-white/10"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Update Location
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoldenHourApp;