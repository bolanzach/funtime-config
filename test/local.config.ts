import {FuntimeConfig} from "../src";
import {IsString} from "class-validator";

export default class LocalConfig extends FuntimeConfig {
  @IsString()
  TEST_STRING = 'local_string';
}
