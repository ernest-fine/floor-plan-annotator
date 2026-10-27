import { MAX_SIGNAL_LENGTH } from "../../domain/limits";
import { useEffect, useRef, useMemo } from "react";
import Button from "@/shared/ui/Button";
import NumericInput from "@/shared/ui/NumericInput";
import { registeredGateways, createGatewayLookup } from "../../domain/gateways";
import {
  normalizeRssiMagnitude,
  rssiMagnitude,
} from "../../domain/signalReadings";
import type { DotAnnotation, GatewayAnnotation } from "../../domain/types";
import type { SignalReadingActions } from "../../types/readings";
import GatewayPills from "./GatewayPills";
import "./SignalReadings.css";

export default function SignalReadings({
  item,
  gateways,
  actions,
}: {
  item: DotAnnotation;
  gateways: GatewayAnnotation[];
  actions: SignalReadingActions;
}) {
  const available = useMemo(() => registeredGateways(gateways), [gateways]);
  const resolveGateway = useMemo(
    () => createGatewayLookup(available),
    [available],
  );
  const readingsTable = useRef<HTMLTableSectionElement>(null);
  const pendingFocus = useRef<{ itemId: string; index: number } | null>(null);
  const cannotAdd = !available.length || item.readings.length >= 300;

  useEffect(() => {
    const pending = pendingFocus.current;
    pendingFocus.current = null;
    if (!pending || pending.itemId !== item.id) return;
    readingsTable.current?.rows[pending.index]
      ?.querySelector<HTMLInputElement>("input")
      ?.focus();
  }, [item.id, item.readings.length]);

  function addReading(gatewayId: string) {
    if (cannotAdd || !available.some((gateway) => gateway.id === gatewayId))
      return;
    pendingFocus.current = { itemId: item.id, index: item.readings.length };
    actions.add(gatewayId);
  }

  return (
    <div id="signal-section" className="section signal-readings">
      <h3 className="signal-readings__heading">Signal test</h3>
      {!available.length && (
        <p className="small muted">
          Add a gateway pin to enter signal readings.
        </p>
      )}
      <GatewayPills
        gateways={available}
        disabled={cannotAdd}
        onAdd={addReading}
      />
      <div className="table-wrap">
        <table className="readings">
          <thead>
            <tr>
              <th scope="col">Gateway name</th>
              <th scope="col">
                RSSI
                <br />
                dBm
              </th>
              <th scope="col">
                SNR
                <br />
                dB
              </th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody id="reading-rows" ref={readingsTable}>
            {item.readings.map((row, index) => {
              const gateway = resolveGateway(row);
              const readingNumber = index + 1;
              return (
                <tr key={index}>
                  <td>
                    <select
                      aria-label={`Gateway name reading ${readingNumber}`}
                      value={gateway?.id ?? ""}
                      disabled={!available.length}
                      onChange={(event) =>
                        actions.update(index, {
                          gatewayId: event.currentTarget.value,
                        })
                      }
                    >
                      {!gateway && (
                        <option value="" disabled>
                          {row.gateway
                            ? `${row.gateway} (unlinked)`
                            : "Select gateway"}
                        </option>
                      )}
                      {available.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <NumericInput
                      aria-label={`RSSI reading ${readingNumber}`}
                      value={rssiMagnitude(row.rssi)}
                      prefix="−"
                      maxLength={MAX_SIGNAL_LENGTH - 1}
                      allowNegative
                      disabled={!gateway}
                      placeholder="85"
                      onValueChange={(value) =>
                        actions.update(index, {
                          rssi: normalizeRssiMagnitude(value),
                        })
                      }
                    />
                  </td>
                  <td>
                    <NumericInput
                      aria-label={`SNR reading ${readingNumber}`}
                      value={row.snr}
                      allowNegative
                      showSignToggle
                      maxLength={MAX_SIGNAL_LENGTH}
                      disabled={!gateway}
                      placeholder="7.5"
                      onValueChange={(snr) => actions.update(index, { snr })}
                    />
                  </td>
                  <td>
                    <Button
                      className="remove-reading"
                      aria-label={`Remove reading ${readingNumber}`}
                      onClick={() => actions.remove(index)}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button
        id="add-reading"
        className="add-reading"
        disabled={cannotAdd}
        onClick={() => {
          const gateway = available[0];
          if (gateway) addReading(gateway.id);
        }}
      >
        + Add gateway reading
      </Button>
      <p className="small muted signal-readings__help">
        RSSI: dBm · SNR: dB. Repeated gateways allowed.
      </p>
    </div>
  );
}
