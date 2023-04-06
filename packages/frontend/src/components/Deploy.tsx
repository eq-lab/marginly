import { FC, useContext, useEffect, useState } from 'react';
import { SignerContext } from '../connection';
import {
  deployMarginly,
  DeployState,
  getMarginlyDeployBundles,
  MarginlyDeployBundle,
  SimpleLogger,
  StateStore,
} from '@marginly/deploy';

const ganacheForkChainId = 1337;

function prepareDeployBundles(bundles: MarginlyDeployBundle[]): MarginlyDeployBundle[] {
  return bundles.map((x) => {
    const config = x.config;
    config.connection.assertChainId = ganacheForkChainId;
    return { name: x.name, config, deployment: x.deployment };
  });
}

export const Deploy: FC = () => {
  const logger = new SimpleLogger((x) => console.log(x));
  const [deployBundles, setDeployBundles] = useState<MarginlyDeployBundle[]>([]);
  const [selectedDeployBundleIndex, setSelectedDeployBundleIndex] = useState<number>(-1);

  const signerContext = useContext(SignerContext);

  const updateDeployBundleList = () => {
    getMarginlyDeployBundles(logger).then((x) => {
      setDeployBundles(prepareDeployBundles(x));
      setSelectedDeployBundleIndex(-1);
    });
  };

  useEffect(() => {
    updateDeployBundleList();
  }, []);

  const deploy = async () => {
    if (signerContext === undefined) {
      console.warn(`signerContext is not set`);
      return;
    }
    if (selectedDeployBundleIndex === -1) {
      console.warn(`deployBundle not selected`);
      return;
    }

    const deploymentResult = await deployMarginly(
      signerContext.signer,
      deployBundles[selectedDeployBundleIndex].config,
      createStateStoreInMemory(),
      new SimpleLogger((x) => console.log(x))
    );

    const resultStr = deploymentResult.marginlyPools.map((x) => x.id + ': ' + x.address).join(', ');
    alert(`Marginly pools deployed: ${resultStr}`);
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <b>Select deploy bundle</b>
      <br />
      <select
        style={{ width: '450px' }}
        onChange={(e) => setSelectedDeployBundleIndex(Number.parseInt(e.target.value))}
        value={selectedDeployBundleIndex}
      >
        <option value={-1} disabled>
          Select a deploy bundle
        </option>
        {deployBundles.map((x, i) => (
          <option key={`option-deploy-bundle-${x.name}`} value={i}>
            {x.name}
          </option>
        ))}
      </select>
      <button onClick={(_) => updateDeployBundleList()}>Reload</button>
      <br />
      <br />
      <button onClick={(_) => deploy()}>Deploy!</button>
      <br />
      <h3>Config</h3>
      <br />
      <textarea
        rows={50}
        cols={100}
        disabled={true}
        value={
          selectedDeployBundleIndex !== -1
            ? JSON.stringify(deployBundles[selectedDeployBundleIndex].config, null, 2)
            : ''
        }
      />

      <br />
    </div>
  );
};

function createStateStoreInMemory(): StateStore {
  const stateById = new Map<string, DeployState>();
  return {
    getById(id: string): DeployState | undefined {
      return stateById.get(id.toLowerCase());
    },
    setById(id: string, deployState: DeployState): void {
      stateById.set(id.toLowerCase(), deployState);
    },
  };
}
