import Button from "@/shared/ui/Button";
export default function GatewayPills({gatewayNames,disabled,onAdd}:{gatewayNames:string[];disabled:boolean;onAdd:(gateway:string)=>void}){return <>              {!!gatewayNames.length && (
                <div
                  className="gateway-pills"
                  role="group"
                  aria-label="Add gateway reading"
                >
                  {gatewayNames.map((gateway) => (
                    <Button
                      key={gateway}
                      type="button"
                      className="gateway-pill"
                      aria-label={`Add reading for ${gateway}`}
                      disabled={disabled}
                      onClick={() => onAdd(gateway)}
                    >
                      {gateway}
                    </Button>
                  ))}
                </div>
              )}</>;}
