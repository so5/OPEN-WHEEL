/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import { jobScheduler } from "../db/db.js";

export const onGetJobSchedulerList = (cb)=>{
  cb(jobScheduler);
};
export const onGetJobSchedulerLabelList = (cb)=>{
  cb(Object.keys(jobScheduler));
};
