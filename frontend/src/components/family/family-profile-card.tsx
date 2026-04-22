import { MapPin, Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface FamilyProfileCardProps {
  recipientName: string;
  city?: string;
  language?: string;
  interests?: string[];
}

export function FamilyProfileCard({
  recipientName,
  city,
  language,
  interests,
}: FamilyProfileCardProps) {
  const initial = recipientName.charAt(0).toUpperCase();

  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <Avatar className="size-12">
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold">{recipientName}</h4>
          <div className="mt-1.5 space-y-1 text-sm text-muted-foreground">
            {city && (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {city}
              </div>
            )}
            {language && (
              <div className="flex items-center gap-1.5">
                <Languages className="size-3.5" /> Speaks {language}
              </div>
            )}
          </div>
          {interests && interests.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {interests.map((interest) => (
                <Badge key={interest} variant="secondary" className="text-xs">
                  {interest}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
