/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs'
import * as process from 'process'

import * as main from '../src/main'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let debugMock: jest.SpiedFunction<typeof core.debug>
let errorMock: jest.SpiedFunction<typeof core.error>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let getBooleanInputMock: jest.SpiedFunction<typeof core.getBooleanInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
// let setOutputMock: jest.SpiedFunction<typeof core.setOutput>
let globCreateMock: jest.SpiedFunction<typeof glob.create>

// mock native calls
let existsSyncMock: jest.SpiedFunction<typeof fs.existsSync>
let writeFileMock: jest.SpiedFunction<typeof fs.promises.writeFile>
jest.mock('fs', () => ({
  existsSync: jest.fn().mockName('existsSync').mockImplementation(),
  promises: {
    writeFile: jest
      .fn()
      .mockName('promises.writeFile')
      .mockResolvedValue(undefined)
  }
}))

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    getBooleanInputMock = jest
      .spyOn(core, 'getBooleanInput')
      .mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    // setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
    globCreateMock = jest.spyOn(glob, 'create').mockImplementation()
    existsSyncMock = fs.existsSync as unknown as typeof existsSyncMock
    writeFileMock = fs.promises.writeFile as unknown as typeof writeFileMock
  })

  it('runs without failure', async () => {
    // Set the action's inputs as return values from core.get*Input()
    const stringInputs: Record<string, string> = {
      'file-patterns': '**glob',
      'manifest-path': 'mockManifest',
      'summary-path': ''
    }
    const booleanInputs: Record<string, boolean> = {
      'follow-symbolic-links': true,
      'use-gitignore': false,
      minify: true
    }
    getInputMock.mockImplementation(name => stringInputs[name] ?? '')
    getBooleanInputMock.mockImplementation(name => booleanInputs[name] ?? false)
    existsSyncMock.mockReturnValue(false)

    const globGeneratorMock = jest.fn(async function* globGenerator() {
      yield `${process.cwd()}/mock`
    })

    globCreateMock.mockImplementation(
      async () =>
        ({
          globGenerator: globGeneratorMock
        }) as unknown as glob.Globber
    )

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(globCreateMock).toHaveBeenCalledWith('**glob', {
      followSymbolicLinks: true
    })
    expect(globGeneratorMock).toHaveBeenCalled()

    expect(debugMock).toHaveBeenNthCalledWith(1, 'Got file: mock')
    expect(debugMock).toHaveBeenNthCalledWith(
      2,
      'Found 1 files, writing to mockManifest'
    )
    expect(writeFileMock).toHaveBeenCalledWith(
      'mockManifest',
      '{"files":{"mock":null}}',
      { encoding: 'utf-8' }
    )
    expect(errorMock).not.toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
  })
})
