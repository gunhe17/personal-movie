import { View, TouchableOpacity } from "react-native";
import {
  SCHEDULE_TYPE_LABELS,
  type ScheduleListItem,
} from "@/features/schedule";
import { formatTimeRange, parseDate } from "@/shared/utils/date";
import { COLORS } from "@/shared/constants/theme";
import { Icon, type IconName } from "@/shared/components/icons";
import { Typography } from "@/shared/components/ui/Typography";
import { GenderAgeMeta } from "@/shared/components/ui/GenderAgeMeta";
import { s } from "@/shared/utils/scale";
import { getAge } from "./utils";

interface UpcomingCardProps {
  item: ScheduleListItem;
  onPress: () => void;
}

export function UpcomingCard({ item, onPress }: UpcomingCardProps) {
  const typeLabel =
    SCHEDULE_TYPE_LABELS[item.schedule_type] ?? item.schedule_type;
  const primary = item.clients?.[0];
  const duration = Math.round(
    (parseDate(item.end).getTime() - parseDate(item.start).getTime()) / 60000,
  );

  return (
    <View
      onLayout={(e) =>
        console.log("[UpcomingCard] measured:", e.nativeEvent.layout)
      }
      style={{
        height: s(216),
        marginHorizontal: s(20),
        marginTop: s(12),
        padding: s(16),
      }}
      className="rounded-lg bg-surface"
    >
      <Typography variant="label-01" weight="medium" className="text-gray-600">
        예정된 상담
      </Typography>

      <View style={{ marginTop: s(8) }} className="flex-row items-center">
        {primary ? (
          <>
            <Typography
              variant="body-01"
              weight="semibold"
              className="text-gray-800"
            >
              {primary.name}
            </Typography>
            {primary.birth_date && (
              <View style={{ marginLeft: s(8) }}>
                <GenderAgeMeta
                  genderLabel={primary.gender === "female" ? "여" : "남"}
                  age={getAge(primary.birth_date)}
                />
              </View>
            )}
          </>
        ) : (
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-gray-800"
          >
            {item.title ?? typeLabel}
          </Typography>
        )}
      </View>

      <View style={{ marginTop: s(12), gap: s(2) }}>
        <InfoLine icon="clock">
          {formatTimeRange(item.start, item.end)}
          <Typography
            variant="body-03"
            className="text-gray-700"
          >{`  (${duration}분)`}</Typography>
        </InfoLine>
        {item.room_name && (
          <InfoLine icon="location">{item.room_name}</InfoLine>
        )}
        <InfoLine icon="program">
          {typeLabel}
          {item.program_name ? ` - ${item.program_name}` : ""}
        </InfoLine>
      </View>

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{ height: s(44) }}
        className="mt-auto items-center justify-center rounded-md bg-primary"
        accessibilityLabel="상담 기록 열기"
        accessibilityRole="button"
      >
        <Typography variant="body-03" weight="medium" className="text-white">
          상담 기록
        </Typography>
      </TouchableOpacity>
    </View>
  );
}

function InfoLine({
  icon,
  children,
}: {
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: s(6) }} className="flex-row items-center">
      <Icon name={icon} size={s(20)} color={COLORS.gray[500]} />
      <Typography variant="body-03" className="text-gray-700">
        {children}
      </Typography>
    </View>
  );
}
