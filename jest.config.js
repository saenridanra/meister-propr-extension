module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^azure-devops-extension-sdk$': '<rootDir>/tests/__mocks__/azure-devops-extension-sdk.ts',
    '^azure-devops-extension-api$': '<rootDir>/tests/__mocks__/azure-devops-extension-api.ts',
    '^axios$': '<rootDir>/tests/__mocks__/axios.ts'
  }
};
