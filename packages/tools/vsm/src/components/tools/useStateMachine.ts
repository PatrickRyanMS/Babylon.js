import { useContext } from "react";
import type { StateMachine } from "../../stateMachine/StateMachine";
import { StateMachineContext } from "../../context/StateMachineContext";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const useStateMachine = () => {
    const { stateMachineWrapper, setStateMachineWrapper } = useContext(StateMachineContext);

    if (!stateMachineWrapper || !setStateMachineWrapper) {
        return {};
    }

    const setStateMachine = (stateMachine: StateMachine) => {
        setStateMachineWrapper({ stateMachine, lastUpdate: Date.now() });
    };

    return { stateMachine: stateMachineWrapper.stateMachine, setStateMachine, lastUpdate: stateMachineWrapper.lastUpdate };
};
