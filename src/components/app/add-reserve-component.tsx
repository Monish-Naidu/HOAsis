"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";

/**
 * Adding something that wears out.
 *
 * A reserve study is a list of components, their lives and their costs, and a
 * board that has never commissioned one can still start the list from what
 * they can see: the roof, the paving, the pool pump. The plan asked them to,
 * and the screen had no way to accept it.
 *
 * This is not a substitute for a study, and the screen says so. It is the
 * difference between a projection built on nothing and one built on the four
 * things everybody already knows about.
 */
export function AddReserveComponent() {
  const { addReserveComponent } = useAppState();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [life, setLife] = useState("25");
  const [remaining, setRemaining] = useState("15");
  const [cost, setCost] = useState("");

  const field =
    "h-10 rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand";
  const cents = Math.round((Number(cost) || 0) * 100);

  function submit() {
        addReserveComponent({
          id: `rc-${Date.now()}`,
          name: name.trim(),
          usefulLifeYears: Math.max(1, Number(life) || 1),
          remainingLifeYears: Math.max(0, Number(remaining) || 0),
          replacementCostCents: cents,
          // Nothing saved against it yet. Assuming otherwise would flatter
          // the funding figure, which is the one number that must not.
          fundedCents: 0,
        });
        setName("");
        setCost("");
        setOpen(false);
        notify(`${name.trim()} added to the reserve schedule`);
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add a component
      </Button>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader
        icon={<Plus className="size-4" />}
        title="Add something that wears out"
        subtitle="A starting list is not a reserve study, but it beats projecting from nothing"
        action={
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      />
      <form
        className="flex flex-wrap items-end gap-3 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && cents > 0) submit();
        }}
      >
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">What it is</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Clubhouse roof"
            aria-label="Component name"
            className={`mt-1.5 w-52 ${field}`}
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Lasts</span>
          <input
            type="number"
            min="1"
            value={life}
            onChange={(e) => setLife(e.target.value)}
            aria-label="Useful life in years"
            className={`mt-1.5 w-24 ${field}`}
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Years left</span>
          <input
            type="number"
            min="0"
            value={remaining}
            onChange={(e) => setRemaining(e.target.value)}
            aria-label="Remaining life in years"
            className={`mt-1.5 w-24 ${field}`}
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Costs to replace</span>
          <input
            type="number"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="42000"
            aria-label="Replacement cost"
            className={`mt-1.5 w-36 ${field}`}
          />
        </label>
        <Button type="submit" disabled={!name.trim() || cents <= 0}>
          Add it
        </Button>
      </form>
    </Card>
  );
}
