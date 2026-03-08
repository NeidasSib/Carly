"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type DateTimePickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const HOURS = Array.from({ length: 24 }, (_, index) => index)
const MINUTES = [0, 15, 30, 45]

function parseDateTime(value: string) {
  if (!value) return undefined
  const [datePart, timePart = "00:00"] = value.split("T")
  const [year, month, day] = datePart.split("-").map(Number)
  const [hours, minutes] = timePart.split(":").map(Number)
  if (!year || !month || !day) return undefined
  const date = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

function toValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = parseDateTime(value)

  function updateDateTime(nextDate: Date) {
    onChange(toValue(nextDate))
  }

  function handleDateSelect(nextDate?: Date) {
    if (!nextDate) return
    const current = date ?? new Date()
    const merged = new Date(
      nextDate.getFullYear(),
      nextDate.getMonth(),
      nextDate.getDate(),
      current.getHours(),
      current.getMinutes(),
      0,
      0
    )
    updateDateTime(merged)
  }

  function handleHourChange(hourString: string) {
    const hour = Number(hourString)
    const base = date ?? new Date()
    const next = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      hour,
      base.getMinutes(),
      0,
      0
    )
    updateDateTime(next)
  }

  function handleMinuteChange(minuteString: string) {
    const minute = Number(minuteString)
    const base = date ?? new Date()
    const next = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      base.getHours(),
      minute,
      0,
      0
    )
    updateDateTime(next)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {date ? format(date, "PPP p") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="border-b p-3">
          <Calendar mode="single" selected={date} onSelect={handleDateSelect} />
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Hour</span>
            <Select
              value={String((date ?? new Date()).getHours())}
              onValueChange={handleHourChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {String(hour).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Minute</span>
            <Select
              value={String((date ?? new Date()).getMinutes() - ((date ?? new Date()).getMinutes() % 15))}
              onValueChange={handleMinuteChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Minute" />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((minute) => (
                  <SelectItem key={minute} value={String(minute)}>
                    {String(minute).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
