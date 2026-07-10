"use client";

import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type Props = {
  value: string;
  onChange: (value: string) => void;
  groups: TeamPickerGroup[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function GroupedTeamSelect({
  value,
  onChange,
  groups,
  placeholder = "Select…",
  required,
  disabled,
  className = "cms-select",
}: Props) {
  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      <option value="">{placeholder}</option>
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
