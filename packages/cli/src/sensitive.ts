import prompts from 'prompts';

export const readSensitiveData = async (label: string): Promise<string> => {
    const response = await prompts({
        type: 'invisible',
        name: 'result',
        message: label,
    });

    return response.result as string;
};
