import {useRef,useEffect} from "react";
import type {DotAnnotation,Reading} from "../../domain/types";
import {blankReading} from "../../domain/signalReadings";
import Button from "@/shared/ui/Button";
import GatewayPills from "./GatewayPills";
export default function SignalReadings({item,gatewayNames,onUpdate}:{item:DotAnnotation;gatewayNames:string[];onUpdate:(patch:{readings:Reading[]})=>void}){
  const readingsTable = useRef<HTMLTableSectionElement>(null);
  const pendingReadingFocus = useRef<{ index: number; gateway: string } | null>(
    null,
  );
  useEffect(() => {
    if (pendingReadingFocus.current === null) return;
    const { index, gateway } = pendingReadingFocus.current;
    const input = readingsTable.current?.rows[
      index
    ]?.querySelector<HTMLInputElement>(
      gateway ? 'input[type="number"]' : 'input[type="text"]',
    );
    pendingReadingFocus.current = null;
    input?.focus();
  }, [item?.id, item?.type === "point" ? item.readings.length : 0]);
  function addReading(gateway = "") {
    if (item?.type !== "point") return;
    if (item.readings.length >= 300) return;
    pendingReadingFocus.current = { index: item.readings.length, gateway };
    onUpdate({ readings: [...item.readings, { ...blankReading(), gateway }] });
  }
  const updateReading = (index: number, key: keyof Reading, value: string) => {
    if (item?.type !== "point") return;
    onUpdate({
      readings: item.readings.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
    });
  };
return (<div id="signal-section" className="section">
              <h3 style={{ marginBottom: 12 }}>Signal test</h3>
              <GatewayPills gatewayNames={gatewayNames} disabled={item.readings.length >= 300} onAdd={addReading}/>
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
                    {item.readings.map((row, index) => (
                      <tr key={index}>
                        {(["gateway", "rssi", "snr"] as const).map((key) => (
                          <td key={key}>
                            <input
                              type={key === "gateway" ? "text" : "number"}
                              inputMode="text"
                              step={key === "gateway" ? undefined : "any"}
                              maxLength={key === "gateway" ? 160 : undefined}
                              aria-label={`${key === "gateway" ? "Gateway name" : key.toUpperCase()} reading ${index + 1}`}
                              value={row[key]}
                              placeholder={
                                key === "gateway"
                                  ? "Gateway name"
                                  : key === "rssi"
                                    ? "-85"
                                    : "7.5"
                              }
                              onChange={(event) =>
                                updateReading(index, key, event.target.value)
                              }
                            />
                          </td>
                        ))}
                        <td>
                          <Button
                            aria-label={`Remove reading ${index + 1}`}
                            onClick={() =>
                              onUpdate({
                                readings: item.readings.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                id="add-reading"
                className="add-reading"
                disabled={item.readings.length >= 300}
                onClick={() => addReading()}
              >
                + Add gateway reading
              </Button>
              <p className="small muted" style={{ marginTop: 10 }}>
                RSSI: dBm · SNR: dB. Repeated gateways allowed.
              </p>
            </div>);
}
